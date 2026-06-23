import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Folder, Photo } from '../types';
import { FolderHeart, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [foldersCount, setFoldersCount] = useState(0);
  const [photosCount, setPhotosCount] = useState(0);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    
    // Get folder count
    const { count: fCount } = await supabase
      .from('folders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    // Get photo count
    const { count: pCount } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Get recent photos
    const { data: recent } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(3);

    setFoldersCount(fCount || 0);
    setPhotosCount(pCount || 0);
    if (recent) setRecentPhotos(recent);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex flex-col md:flex-row md:items-start justify-between mb-10 shrink-0">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-2">Overview</h1>
          <p className="text-slate-500">Welcome back {profile?.full_name?.split(' ')[0]}, your private memories are safe.</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-4">
          <Link to="/folders" className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 transition-colors">
            <FolderHeart size={16} />
            Create Folder
          </Link>
          <Link to="/photos" className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">
            <UploadCloud size={16} />
            Upload Media
          </Link>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 shrink-0">
        <div className="vault-card p-6 flex flex-col justify-between h-40">
          <p className="text-xs uppercase tracking-widest font-semibold text-slate-400">Total Folders</p>
          <p className="text-4xl stat-value">{foldersCount}</p>
          <div className="text-xs text-indigo-600 font-medium">View all folders →</div>
        </div>
        
        <div className="vault-card p-6 flex flex-col justify-between h-40">
          <p className="text-xs uppercase tracking-widest font-semibold text-slate-400">Total Photos</p>
          <p className="text-4xl stat-value">{photosCount}</p>
          <div className="text-xs text-indigo-600 font-medium">In {foldersCount} folders</div>
        </div>

        <div className="vault-card p-6 flex flex-col justify-between h-40">
          <p className="text-xs uppercase tracking-widest font-semibold text-slate-400">Storage Health</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-700">Vault Capacity</span>
              <span>Active</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Secure Storage Active</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-1 overflow-hidden min-h-0">
        <div className="md:col-span-3 space-y-6 flex flex-col overflow-hidden">
          <h3 className="text-lg font-bold shrink-0">Recent Uploads</h3>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-2 pb-4">
            {recentPhotos.length > 0 ? (
              recentPhotos.map(photo => (
                <div key={photo.id} className="vault-card p-5 group cursor-pointer hover:border-indigo-300 transition-all flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-100">
                    <ImageIcon size={24} />
                  </div>
                  <p className="font-bold text-slate-800 text-sm truncate w-full">{photo.file_name}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(photo.uploaded_at).toLocaleDateString()}</p>
                </div>
              ))
            ) : (
              <div className="col-span-full vault-card p-10 flex flex-col items-center justify-center text-center text-slate-500">
                <ImageIcon size={32} className="text-slate-300 mb-2" />
                <p className="font-bold">No photos yet</p>
                <p className="text-xs mt-1">Upload media to see them here</p>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 vault-card flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
            <h3 className="font-bold">Activity</h3>
            <button className="text-xs text-indigo-600 font-bold">Clear All</button>
          </div>
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {recentPhotos.length > 0 ? (
               recentPhotos.map((photo, i) => (
                 <div key={'act'+photo.id} className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    <UploadCloud size={20} className="text-slate-400" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold truncate">{photo.file_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-tighter truncate">Uploaded • {new Date(photo.uploaded_at).toLocaleDateString()}</p>
                  </div>
                  {i === 0 && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>}
                 </div>
               ))
            ) : (
                <div className="text-center text-xs text-slate-400">No recent activity</div>
            )}
          </div>
          <div className="p-4 bg-slate-50 mt-auto shrink-0 border-t border-slate-100">
            <button className="w-full py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors">
              View Full Audit Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
