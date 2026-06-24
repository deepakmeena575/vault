import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Photo, Folder } from '../types';
import { Image as ImageIcon, UploadCloud, Trash2, ExternalLink } from 'lucide-react';

export const Photos: React.FC = () => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFolders();
    fetchPhotos();
  }, []);

  const fetchFolders = async () => {
    if (!user) return;
    const { data } = await supabase.from('folders').select('*').eq('user_id', user.id);
    if (data) setFolders(data);
  };

  const fetchPhotos = async () => {
    if (!user) return;
    let query = supabase.from('photos').select('*').eq('user_id', user.id).order('uploaded_at', { ascending: false });
    if (selectedFolder) query = query.eq('folder_id', selectedFolder);
    const { data } = await query;
    if (data) {
      // Get signed URLs for each photo
      const photosWithUrls = await Promise.all(data.map(async (p: any) => {
        if (p.storage_path) {
          const { data: signedUrlData } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 60 * 60);
          return { ...p, file_url: signedUrlData?.signedUrl || p.file_url };
        }
        return p;
      }));
      setPhotos(photosWithUrls);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [selectedFolder]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    
    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            console.log("UPLOAD_START", file.name);
            setUploadProgress(10);
            
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const storagePath = `${user.id}/${fileName}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('photos')
              .upload(storagePath, file, {
                upsert: false
              });
              
            if (uploadError) {
              console.error("UPLOAD_ERROR", uploadError);
              throw uploadError;
            }
            
            console.log("UPLOAD_SUCCESS", uploadData);
            setUploadProgress(60);
            
            // Generate signed URL
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from('photos').createSignedUrl(storagePath, 60 * 60);

            if (signedUrlError) {
              console.error("SIGNED_URL_ERROR", signedUrlError);
            } else {
              console.log("SIGNED_URL_SUCCESS", signedUrlData);
            }

            // Insert metadata into Supabase
            const { data: dbData, error: dbError } = await supabase.from('photos').insert({
                user_id: user.id,
                folder_id: selectedFolder || null,
                file_name: file.name,
                storage_path: storagePath,
                file_url: signedUrlData?.signedUrl || ''
            });

            if (dbError) {
              console.error("PHOTO_DB_INSERT_ERROR", dbError);
              throw dbError;
            }
            
            console.log("PHOTO_DB_INSERT_SUCCESS", dbData);
            setUploadProgress(100);

        } catch (error) {
            console.error("UPLOAD_ERROR_CAUGHT", error);
            alert(`Upload failed for ${file.name}.`);
        }
    }
    
    setUploading(false);
    setTimeout(() => setUploadProgress(0), 1000);
    fetchPhotos();
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, storagePath: string) => {
    if(!confirm("Are you sure you want to delete this photo?")) return;

    try {
      // Delete from Storage first
      if (storagePath) {
        await supabase.storage.from('photos').remove([storagePath]);
      }
      
      // Delete from DB
      await supabase.from('photos').delete().eq('id', id);
      
      fetchPhotos();
    } catch (e) {
      console.error("Failed to delete", e);
      alert("Failed to delete photo.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex flex-col md:flex-row md:items-start justify-between mb-10 shrink-0 gap-4">
        <h1 className="text-5xl font-extrabold tracking-tight mb-2">Gallery</h1>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200">
            <select
                className="border-none bg-transparent px-4 py-2 font-semibold text-slate-700 outline-none cursor-pointer"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
            >
                <option value="">All Folders</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.folder_name}</option>)}
            </select>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="relative">
                <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/jpeg, image/png, image/webp" 
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                >
                    <UploadCloud size={18} />
                    {uploading ? 'Uploading...' : 'Upload'}
                </button>
            </div>
        </div>
      </header>

      {uploadProgress > 0 && (
          <div className="w-full bg-slate-200 rounded-full h-2 mb-6 shrink-0 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
          </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto pb-8">
        {photos.map(photo => (
          <div key={photo.id} className="vault-card overflow-hidden group border border-slate-200">
            <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center relative overflow-hidden">
                {photo.file_url ? (
                  <img src={photo.file_url} alt={photo.file_name} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon size={48} className="text-slate-300" />
                )}
                
                <div className="absolute inset-0 bg-slate-900 bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3">
                    {photo.file_url && (
                      <a href={photo.file_url} target="_blank" rel="noreferrer" className="p-3 bg-white text-slate-800 rounded-xl hover:bg-slate-100 shadow-sm transition-transform hover:scale-105" title="View Full Image">
                          <ExternalLink size={20} />
                      </a>
                    )}
                    <button onClick={() => handleDelete(photo.id, photo.storage_path)} className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-sm transition-transform hover:scale-105" title="Delete">
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>
            <div className="p-5">
                <h3 className="font-bold text-slate-800 text-sm truncate">{photo.file_name}</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">{new Date(photo.uploaded_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
        {photos.length === 0 && (
          <div className="col-span-full vault-card py-16 text-center text-slate-500 flex flex-col items-center justify-center">
            <ImageIcon size={48} className="text-slate-300 mb-4" />
            <p className="font-bold text-lg text-slate-700">Gallery is empty</p>
            <p className="text-sm mt-1">Upload photos to start filling up your vault.</p>
          </div>
        )}
      </div>
    </div>
  );
};
