import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderHeart, Image as ImageIcon, HardDrive, Shield } from 'lucide-react';
import { Profile, Photo } from '../types';

import { supabase } from '../lib/supabase';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ 
    totalUsers: 0, 
    totalPhotos: 0, 
    totalStorageUsed: '0.0 MB', 
    recentUploads: [] as any[], 
    users: [] as Profile[] 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/admin/stats', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error("Failed to load admin stats");
      const data = await res.json();
      if (data.success) {
        setStats({
          totalUsers: data.totalUsers,
          totalPhotos: data.totalPhotos,
          totalStorageUsed: data.totalStorageUsed || '0.0 MB',
          recentUploads: data.recentUploads || [],
          users: data.users || []
        });
      }
    } catch (e) {
      console.error("Failed to load admin stats", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex flex-col items-center justify-center space-y-3 h-full min-h-[300px]">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 font-semibold text-xs">Loading admin stats...</p>
    </div>
  );

  return (
    <div className="space-y-6 flex flex-col h-full overflow-y-auto pb-12 px-4 sm:px-6">
      <div className="shrink-0 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Admin Control Panel</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">Global overview of system metrics and user activities</p>
      </div>

      {/* Admin Mode Switcher */}
      <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shrink-0">
        <Link 
          to="/admin" 
          className="flex-1 py-2 px-3 text-center bg-white text-indigo-600 font-bold rounded-lg text-xs shadow-sm"
        >
          Overview Stats
        </Link>
        <Link 
          to="/admin/photos" 
          className="flex-1 py-2 px-3 text-center text-slate-600 hover:text-slate-900 font-semibold rounded-lg text-xs hover:bg-white/50 transition-all"
        >
          All Users' Photos
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users size={20} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalUsers}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ImageIcon size={20} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Photos</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalPhotos}</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <HardDrive size={20} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Storage Used</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.totalStorageUsed}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Recent Uploads</h3>
          </div>
          <div className="p-6 overflow-y-auto space-y-4">
            {stats.recentUploads.length > 0 ? stats.recentUploads.map(photo => (
              <div key={photo.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                    <ImageIcon size={18} />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold text-slate-800 truncate">{photo.file_name}</p>
                    <p className="text-xs text-slate-500 truncate">by {photo.profiles?.full_name || 'Unknown'}</p>
                  </div>
                </div>
                {photo.file_url && (
                  <a href={photo.file_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0 ml-2">
                    View Image
                  </a>
                )}
              </div>
            )) : <p className="text-sm text-slate-500">No recent uploads.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">User List</h3>
          </div>
          <div className="p-6 overflow-y-auto space-y-4">
            {stats.users.length > 0 ? stats.users.map((u: any) => (
              <div key={u.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{u.full_name || 'Anonymous'}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  <div className="flex gap-4 mt-1.5 text-[11px] text-slate-500 font-medium">
                    <span>Photos: <strong className="text-slate-800">{u.photo_count ?? 0}</strong></span>
                    {u.latest_upload_date ? (
                      <span>Last Upload: <strong className="text-slate-800">{new Date(u.latest_upload_date).toLocaleDateString()}</strong></span>
                    ) : (
                      <span className="text-slate-400">No uploads</span>
                    )}
                  </div>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-600 shrink-0 ml-2">
                  {u.role}
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No users found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
