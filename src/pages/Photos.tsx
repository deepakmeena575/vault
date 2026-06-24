import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Photo, Folder } from '../types';
import { Image as ImageIcon, UploadCloud, Trash2, Download, ExternalLink } from 'lucide-react';

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
    if (data) setPhotos(data);
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
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.id);
        if (selectedFolder) {
            formData.append('folder_id', selectedFolder);
            // Optionally append folder_name if needed by backend
        }

        try {
            // Simulated progress because standard fetch doesn't support progress easily without XHR
            const progressInterval = setInterval(() => {
                setUploadProgress(p => Math.min(p + 10, 90));
            }, 500);

            // Need to point to dynamic API url due to AI Studio env
            const API_URL = import.meta.env.VITE_APP_URL || '';
            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (!res.ok) {
                let errMessage = 'Upload failed';
                try {
                    const err = await res.json();
                    errMessage = err.error || errMessage;
                } catch(e) {
                    errMessage = `Server error ${res.status}. Response was not JSON.`;
                }
                alert(errMessage);
            } else {
                const uploadData = await res.json();
                
                if (!uploadData.photo) {
                    // Fallback: Insert metadata into Supabase from frontend if backend didn't
                    const { error: dbError } = await supabase.from('photos').insert({
                        user_id: user.id,
                        folder_id: selectedFolder || null,
                        file_name: uploadData.file_name,
                        drive_file_id: uploadData.drive_file_id,
                        file_url: uploadData.file_url
                    });
    
                    if (dbError) {
                        console.error("Database insert error:", dbError);
                        alert("Upload to Drive succeeded, but saving metadata to database failed due to missing RLS permissions.");
                    }
                }
            }
        } catch (error) {
            console.error("Upload error", error);
            alert("Upload failed. Are backend Drive credentials configured?");
        }
    }
    
    setUploading(false);
    setTimeout(() => setUploadProgress(0), 1000);
    fetchPhotos();
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, driveFileId: string) => {
    if(!confirm("Are you sure you want to delete this photo?")) return;

    // Delete from DB first
    await supabase.from('photos').delete().eq('id', id);
    
    // Attempt delete from Drive via backend
    try {
        const API_URL = import.meta.env.VITE_APP_URL || '';
        await fetch(`${API_URL}/api/photo/${driveFileId}`, { method: 'DELETE' });
    } catch (e) {
        console.error("Failed to delete from Drive", e);
    }

    fetchPhotos();
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
            <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center relative">
                {/* Due to Google Drive privacy, displaying direct images requires specific permissions/headers. Provide icon or implement proxy if needed. */}
                <ImageIcon size={48} className="text-slate-300" />
                
                <div className="absolute inset-0 bg-slate-900 bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3">
                    {photo.file_url && (
                      <a href={photo.file_url} target="_blank" rel="noreferrer" className="p-3 bg-white text-slate-800 rounded-xl hover:bg-slate-100 shadow-sm transition-transform hover:scale-105" title="View in Drive">
                          <ExternalLink size={20} />
                      </a>
                    )}
                    <button onClick={() => handleDelete(photo.id, photo.drive_file_id)} className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-sm transition-transform hover:scale-105" title="Delete">
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
