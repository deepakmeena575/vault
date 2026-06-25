import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Download, ChevronLeft, ChevronRight, Folder, Mail, User, Clock, HardDrive, Shield } from 'lucide-react';
import { Photo } from '../types';

export const AdminPhotos: React.FC = () => {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(9);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
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

  // Reset page when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const totalItems = photos.length;
  const computedItemsPerPage = itemsPerPage === 'All' ? totalItems : itemsPerPage;
  const totalPages = computedItemsPerPage > 0 ? Math.ceil(totalItems / computedItemsPerPage) : 1;

  const startIndex = (currentPage - 1) * (computedItemsPerPage || 1);
  const paginatedPhotos = photos.slice(startIndex, startIndex + (computedItemsPerPage || totalItems));

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center space-y-3 h-full min-h-[300px]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-semibold text-xs">Fetching latest vault uploads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-full pb-12 px-4 sm:px-6">
      {/* Page Title */}
      <div className="shrink-0 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Admin Control Panel</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Vault Media</h1>
        <p className="text-xs text-slate-500 mt-0.5">Audit and view all secure images uploaded by active users</p>
      </div>

      {/* Admin Mode Switcher */}
      <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shrink-0">
        <Link 
          to="/admin" 
          className="flex-1 py-2 px-3 text-center text-slate-600 hover:text-slate-900 font-semibold rounded-lg text-xs hover:bg-white/50 transition-all"
        >
          Overview Stats
        </Link>
        <Link 
          to="/admin/photos" 
          className="flex-1 py-2 px-3 text-center bg-white text-indigo-600 font-bold rounded-lg text-xs shadow-sm"
        >
          All Users' Photos
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/70 shrink-0">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Records</span>
            <h3 className="font-black text-slate-800 text-lg">{photos.length} Photos</h3>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-slate-500 shrink-0">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const val = e.target.value;
                setItemsPerPage(val === 'All' ? 'All' : parseInt(val, 10));
              }}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-100 text-slate-700"
            >
              <option value="9">9 per page</option>
              <option value="18">18 per page</option>
              <option value="36">36 per page</option>
              <option value="All">Show All ({photos.length})</option>
            </select>
          </div>
        </div>

        {/* Photos Grid */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/20">
          {paginatedPhotos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedPhotos.map((photo) => (
                <div key={photo.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col hover:border-indigo-300 transition-all group">
                  {/* Image Thumbnail */}
                  <div className="relative aspect-[4/3] bg-slate-100 border-b border-slate-100 overflow-hidden">
                    {photo.file_url ? (
                      <img 
                        src={photo.file_url} 
                        alt={photo.file_name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon size={32} />
                        <span className="text-[10px] mt-1">No Signed URL</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div>
                        <p className="font-extrabold text-slate-800 text-xs truncate" title={photo.file_name}>
                          {photo.file_name}
                        </p>
                      </div>

                      {/* User Info */}
                      <div className="bg-slate-50 rounded-xl p-2.5 space-y-1.5 border border-slate-100 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <User size={12} className="text-indigo-500 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {photo.profiles?.full_name || 'Anonymous User'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Mail size={12} className="text-indigo-400 shrink-0" />
                          <span className="truncate">{photo.profiles?.email || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Meta information */}
                      <div className="space-y-1.5 text-[10px] text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span>Uploaded: <strong className="text-slate-700">{new Date(photo.uploaded_at).toLocaleString()}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Folder size={11} className="text-slate-400 shrink-0" />
                          <span>
                            Folder:{' '}
                            {photo.folders?.folder_name ? (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                                {photo.folders.folder_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None assigned</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <HardDrive size={11} className="text-slate-400 shrink-0" />
                          <span>
                            Size:{' '}
                            <strong className="text-indigo-600">
                              {photo.size_mb ? `${photo.size_mb.toFixed(1)} MB` : '0.5 MB'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* View/Download action */}
                    {photo.file_url && (
                      <div className="pt-3 border-t border-slate-100 flex justify-end">
                        <a 
                          href={photo.file_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors w-full justify-center"
                        >
                          <Download size={13} />
                          <span>View Original</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <ImageIcon size={48} className="mb-4 text-slate-300" />
              <p className="font-medium text-sm">No photos have been uploaded yet.</p>
            </div>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && itemsPerPage !== 'All' && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs font-bold text-slate-600">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
