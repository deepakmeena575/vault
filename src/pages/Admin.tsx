import React, { useEffect, useState } from 'react';
import { Users, FolderHeart, Image as ImageIcon, HardDrive } from 'lucide-react';
import { Profile, Photo } from '../types';

import { supabase } from '../lib/supabase';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ 
    totalUsers: 0, 
    totalPhotos: 0, 
    totalStorageUsed: 'N/A (Supabase)', 
    recentUploads: [] as any[], 
    users: [] as Profile[] 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error("Failed to load admin stats");
      const data = await res.json();
      if (data.success) {
        setStats({
          totalUsers: data.totalUsers,
          totalPhotos: data.totalPhotos,
          totalStorageUsed: 'N/A (Supabase)',
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

  if (loading) return <div className="p-8">Loading admin data...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Users</p>
          </div>
          <p className="text-4xl font-extrabold text-slate-900">{stats.totalUsers}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <ImageIcon size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Photos</p>
          </div>
          <p className="text-4xl font-extrabold text-slate-900">{stats.totalPhotos}</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between md:col-span-2">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <HardDrive size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Storage Used</p>
          </div>
          <p className="text-4xl font-extrabold text-slate-900">{stats.totalStorageUsed}</p>
          <p className="text-xs text-slate-400 mt-2">Storage is managed via Supabase Storage</p>
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
