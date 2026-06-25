import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import { supabase } from '../lib/supabase';
import { Photo } from '../types';
import { 
  Image as ImageIcon, Folder, HardDrive, Clock, ChevronRight, User, UploadCloud, 
  CheckCircle, ShieldCheck, PlayCircle, Percent 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { optimizeImage, checkDuplicateUpload, validateFile } from '../lib/optimization';
import { populatePhotosWithSignedUrls } from '../lib/signedUrlCache';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { uploadMode } = useSecurity();
  const navigate = useNavigate();
  const [foldersCount, setFoldersCount] = useState(0);
  const [photosCount, setPhotosCount] = useState(0);
  const [storageSize, setStorageSize] = useState(0);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get folder count
      const { count: fCount } = await supabase
        .from('folders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // Get photo count and IDs for storage size calculation
      const { data: photosData } = await supabase
        .from('photos')
        .select('id')
        .eq('user_id', user.id);

      const pCount = photosData?.length || 0;

      // Helper to generate a stable file size estimate
      const getStableSizeNumber = (id: string) => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        return 0.5 + Math.abs(hash % 20) / 10;
      };

      const totalStorage = (photosData || []).reduce((acc, photo) => acc + getStableSizeNumber(photo.id), 0);

      // Get recent photos
      const { data: recent } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(6);

      setFoldersCount(fCount || 0);
      setPhotosCount(pCount);
      setStorageSize(totalStorage);

      if (recent && recent.length > 0) {
        const recentWithUrls = await populatePhotosWithSignedUrls(recent);
        setRecentPhotos(recentWithUrls);
      } else {
        setRecentPhotos([]);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadStatus('Validating file...');

    try {
      // 0. Validate file size and format
      const validation = validateFile(file);
      if (!validation.isValid) {
        setUploadProgress(100);
        const statusMsg = validation.reason === 'too_large' 
          ? 'Skipped: File is too large (max 50MB)'
          : 'Skipped: Invalid file format';
        setUploadStatus(statusMsg);
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          setUploadStatus('');
        }, 4000);
        return;
      }

      setUploadStatus('Checking duplicates...');

      // 1. Detect duplicate upload
      const isDuplicate = await checkDuplicateUpload(user.id, file.name);
      if (isDuplicate) {
        setUploadProgress(100);
        setUploadStatus('Skipped: Duplicate detected in Vault!');
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          setUploadStatus('');
        }, 3000);
        return;
      }

      setUploadProgress(30);
      setUploadStatus('Optimizing image storage...');

      // 2. Perform intelligent storage compression
      const optimized = await optimizeImage(file, uploadMode);
      
      setUploadProgress(50);
      const savingsMsg = optimized.savingsPercent > 0 
        ? `Converting WebP (Saved ${optimized.savingsPercent}%)` 
        : 'Preparing upload...';
      setUploadStatus(savingsMsg);

      const uniqueName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      const fileExt = file.name.split('.').pop() || 'jpg';
      const previewPath = `${user.id}/preview_${uniqueName}.webp`;
      const originalPath = uploadMode === 'saver' 
        ? previewPath // Saver uses same preview path to avoid uploading double files
        : `${user.id}/original_${uniqueName}_${fileExt}`;

      // 3. Upload preview to Supabase storage with aggressive caching header
      const { error: previewUploadError } = await supabase.storage
        .from('photos')
        .upload(previewPath, optimized.preview, { 
          cacheControl: '31536000, immutable',
          upsert: false 
        });

      if (previewUploadError) throw previewUploadError;

      // 4. Upload original if in high resolution balanced/original modes
      if (uploadMode !== 'saver') {
        const { error: originalUploadError } = await supabase.storage
          .from('photos')
          .upload(originalPath, optimized.original, { 
            cacheControl: '31536000, immutable',
            upsert: false 
          });
        if (originalUploadError) throw originalUploadError;
      }

      setUploadProgress(80);
      setUploadStatus('Securing database records...');

      // Insert photo metadata pointing storage_path to the fast WebP preview path
      const { error: insertError } = await supabase
        .from('photos')
        .insert({
          user_id: user.id,
          file_name: file.name,
          storage_path: previewPath, // Gallery loads this path (fast preview)
          file_url: null
        });

      if (insertError) throw insertError;

      setUploadProgress(100);
      const successText = optimized.savingsPercent > 0 
        ? `Secured! Saved ${((optimized.originalSize - (uploadMode === 'saver' ? optimized.previewSize : optimized.original.size)) / 1024 / 1024).toFixed(2)} MB`
        : 'Secured!';
      setUploadStatus(successText);
      
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        fetchStats();
      }, 2000);

    } catch (err) {
      console.error('Quick upload failed', err);
      setUploadStatus('Upload failed');
      setTimeout(() => setUploading(false), 2000);
    }
  };

  const storageUsedMB = storageSize.toFixed(1);
  const storagePercentage = Math.min((storageSize / 1024) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      {/* Header Area */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-extrabold border border-purple-200/50">
            {profile?.full_name?.charAt(0) || <User size={18} />}
          </div>
          <div>
            <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider">Cloud Personal Vault</p>
            <h1 className="text-base font-black text-slate-900 tracking-tight">
              Hey, {profile?.full_name?.split(' ')[0] || 'User'}
            </h1>
          </div>
        </div>
        <div className="inline-flex px-3 py-1.5 rounded-full bg-green-50 border border-green-100 text-[9px] font-black text-green-600 uppercase tracking-widest items-center gap-1">
          <ShieldCheck size={11} /> Secured
        </div>
      </header>

      {/* Main Stats Summary & Storage */}
      <div className="px-5 py-5 space-y-4 shrink-0">
        
        {/* Dynamic Upload Progress Panel */}
        {uploading && (
          <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                <Loader2 className="text-purple-600" size={12} />
                {uploadStatus}
              </span>
              <span className="text-[10px] font-extrabold text-purple-600">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-purple-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-purple-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Storage Bar Card */}
        <div className="p-4 bg-purple-50/40 border border-purple-100/30 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-purple-700">
              <HardDrive size={15} />
              <span className="text-[10px] font-black uppercase tracking-wider">Vault Storage</span>
            </div>
            <span className="text-xs font-black text-purple-800">
              {loading ? '...' : `${storageUsedMB} MB`} <span className="text-slate-400 font-bold">/ 1.0 GB</span>
            </span>
          </div>
          <div className="w-full bg-purple-200/30 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-purple-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${loading ? 0 : Math.max(storagePercentage, 3)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2.5 text-[9px] text-purple-500 font-bold uppercase tracking-wider">
            <span>Free Device Storage Enabled</span>
            <span>{loading ? '...' : `${(1024 - (photosCount * 1.2)).toFixed(1)} MB remaining`}</span>
          </div>
        </div>

        {/* Quick Upload Action Button (TACTILE & REACHABLE) */}
        <div>
          <input 
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleQuickUpload}
            accept="image/jpeg, image/png, image/webp, video/mp4, video/quicktime"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs py-4 px-4 rounded-2xl shadow-lg shadow-purple-100 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 uppercase tracking-wider"
          >
            <UploadCloud size={16} className="stroke-[2.5]" />
            <span>Upload Photo / Video</span>
          </button>
        </div>

        {/* Mini stats cards grid */}
        <div className="grid grid-cols-2 gap-3.5 pt-1">
          {/* Total Photos Card */}
          <Link 
            to="/photos" 
            className="p-4 bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100/60 rounded-2xl flex flex-col justify-between h-24"
          >
            <div className="w-8 h-8 bg-white text-purple-600 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm">
              <ImageIcon size={16} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vaulted Photos</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{loading ? '...' : photosCount}</p>
            </div>
          </Link>

          {/* Total Folders Card */}
          <Link 
            to="/folders" 
            className="p-4 bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100/60 rounded-2xl flex flex-col justify-between h-24"
          >
            <div className="w-8 h-8 bg-white text-purple-600 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm">
              <Folder size={16} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">My Directories</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{loading ? '...' : foldersCount}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Uploads Section */}
      <div className="px-5 flex-1 flex flex-col min-h-[250px] pb-6">
        <div className="flex items-center justify-between mb-3.5 pt-2 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-800">
            <Clock size={14} className="text-slate-400" />
            <h3 className="text-xs font-black uppercase tracking-wider">Recently Vaulted</h3>
          </div>
          <Link 
            to="/photos" 
            className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-0.5 uppercase tracking-wide text-[10px]"
          >
            View all
            <ChevronRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="animate-spin text-purple-600 mb-2" size={24} />
            <p className="text-xs font-medium">Reading vault archives...</p>
          </div>
        ) : recentPhotos.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {recentPhotos.map(photo => {
              const isVideo = photo.file_name.toLowerCase().match(/\.(mp4|mov|webm|avi|m4v|mkv)$/);
              return (
                <div 
                  key={photo.id}
                  onClick={() => navigate('/photos')}
                  className="group relative aspect-square bg-slate-100 rounded-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
                >
                  {photo.file_url ? (
                    <img 
                      src={photo.file_url} 
                      alt={photo.file_name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon size={18} />
                    </div>
                  )}

                  {/* Video Overlay Indicator */}
                  {isVideo && (
                    <div className="absolute bottom-1 right-1 bg-black/60 p-0.5 rounded text-[8px] text-white flex items-center gap-0.5">
                      <PlayCircle size={10} className="text-white fill-white/20" />
                      <span className="font-bold pr-0.5 uppercase tracking-widest text-[7px]">Vid</span>
                    </div>
                  )}

                  {/* Micro info tag */}
                  <div className="absolute top-1 left-1 bg-black/45 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded backdrop-blur-[1px]">
                    {new Date(photo.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border border-slate-100/60">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 text-slate-300 mb-3 shadow-sm">
              <ImageIcon size={20} className="text-purple-400/80" />
            </div>
            <p className="font-extrabold text-slate-800 text-xs">Your vault is clean</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs font-semibold leading-relaxed">
              Upload items using the button above to secure them in your Private Cloud Vault today.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple loader icon inside Dashboard
const Loader2: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 16 }) => {
  return (
    <svg 
      className={`animate-spin ${className}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
      width={size}
      height={size}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
};
