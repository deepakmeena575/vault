import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Download } from 'lucide-react';
import { Photo } from '../types';

import { supabase } from '../lib/supabase';

export const AdminPhotos: React.FC = () => {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const res = await fetch('/api/admin/photos');
      if (!res.ok) throw new Error("Failed to load admin photos");
      const resData = await res.json();
      if (resData.success) {
        setPhotos(resData.photos || []);
      }
    } catch (e) {
      console.error("Failed to load admin photos", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading photos...</div>;

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">All Photos</h1>
        <p className="text-slate-500 mt-2">Manage all uploaded media across the platform</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-700 text-sm">{photos.length} Photos total</h3>
        </div>
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.length > 0 ? photos.map(photo => (
            <div key={photo.id} className="vault-card p-4 group flex flex-col justify-between">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                  <ImageIcon size={24} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="font-bold text-slate-800 text-sm truncate" title={photo.file_name}>{photo.file_name}</p>
                  <p className="text-xs text-slate-500 truncate">by {photo.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(photo.uploaded_at).toLocaleString()}</p>
                </div>
              </div>
              {photo.file_url && (
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <a 
                    href={photo.file_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download size={14} />
                    View / Download
                  </a>
                </div>
              )}
            </div>
          )) : (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
              <ImageIcon size={48} className="mb-4 text-slate-300" />
              <p>No photos have been uploaded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
