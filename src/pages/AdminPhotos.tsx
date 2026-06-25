import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Image as ImageIcon, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Folder, 
  Mail, 
  User, 
  Clock, 
  HardDrive, 
  Shield,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Heart,
  Trash2,
  Copy,
  UserCheck,
  ChevronUp,
  ChevronDown,
  Info,
  ExternalLink,
  FolderOpen
} from 'lucide-react';
import { Photo } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const AdminPhotos: React.FC = () => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Folders state
  const [allFolders, setAllFolders] = useState<any[]>([]);

  // Favorites list (local storage)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(9);

  // Fullscreen Viewer State
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Mobile touch navigation and pinch-to-zoom state
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [touchDragStart, setTouchDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageResolution, setImageResolution] = useState<string>('Detecting...');

  // Vertical dragging state (for swipe down to close)
  const [translateY, setTranslateY] = useState(0);
  const [isVerticalDragging, setIsVerticalDragging] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // New Collapsible info panel state
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  // Quick action states
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [viewingUser, setViewingUser] = useState<any | null>(null);
  const [viewerToast, setViewerToast] = useState<string | null>(null);

  const imgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPhotos();
    fetchFolders();
  }, []);

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`vault_favorites_${user.id}`);
      if (saved) {
        setFavoriteIds(JSON.parse(saved));
      }
    }
  }, [user]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/photos', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
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

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase.from('folders').select('*');
      if (!error && data) {
        setAllFolders(data);
      }
    } catch (err) {
      console.error("Failed to load folders", err);
    }
  };

  // Disable background scrolling when the viewer is active
  useEffect(() => {
    if (activePhotoIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activePhotoIndex]);

  // Reset zoom & position & sheets when changing active photo
  useEffect(() => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
    setImageLoaded(false);
    setImageResolution('Detecting...');
    setTranslateY(0);
    setIsVerticalDragging(false);
  }, [activePhotoIndex]);

  // Keyboard navigation & Close & Zoom keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activePhotoIndex === null) return;
      
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhotoIndex, photos, scale]);

  // Preload previous, current, and next image dynamically to keep in cache
  useEffect(() => {
    if (activePhotoIndex !== null && photos.length > 0) {
      const prevIdx = (activePhotoIndex - 1 + photos.length) % photos.length;
      const nextIdx = (activePhotoIndex + 1) % photos.length;

      const prevPhoto = photos[prevIdx];
      const nextPhoto = photos[nextIdx];

      if (prevPhoto?.file_url) {
        const imgPrev = new Image();
        imgPrev.src = prevPhoto.file_url;
      }
      if (nextPhoto?.file_url) {
        const imgNext = new Image();
        imgNext.src = nextPhoto.file_url;
      }
    }
  }, [activePhotoIndex, photos]);

  // Auto-scroll bottom filmstrip strip so active item always stays centered
  useEffect(() => {
    if (activePhotoIndex !== null) {
      const thumb = document.getElementById(`filmstrip-thumb-${activePhotoIndex}`);
      if (thumb) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activePhotoIndex]);

  // Wheel zoom with passive: false to allow e.preventDefault()
  useEffect(() => {
    const container = imgContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.15;
      setScale((prevScale) => {
        let nextScale = prevScale;
        if (e.deltaY < 0) {
          nextScale = prevScale * zoomFactor;
        } else {
          nextScale = prevScale / zoomFactor;
        }
        return Math.min(4.0, Math.max(0.6, nextScale));
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [imgContainerRef.current, activePhotoIndex]);

  const handlePrev = () => {
    if (photos.length === 0) return;
    setActivePhotoIndex((prev) => {
      if (prev === null) return null;
      return (prev - 1 + photos.length) % photos.length;
    });
  };

  const handleNext = () => {
    if (photos.length === 0) return;
    setActivePhotoIndex((prev) => {
      if (prev === null) return null;
      return (prev + 1) % photos.length;
    });
  };

  const handleClose = () => {
    setActivePhotoIndex(null);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(4.0, prev + 0.3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.6, prev - 0.3));
  };

  const handleResetZoom = () => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
  };

  // Double tap toggle fullscreen state
  const toggleFullscreen = () => {
    const viewerElem = document.getElementById('immersive-gallery-viewer');
    if (!viewerElem) return;
    if (!document.fullscreenElement) {
      viewerElem.requestFullscreen().catch(err => {
        console.error("Fullscreen request failed", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Mouse Drag / Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1.0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double Click toggles zoom
  const handleDoubleClick = () => {
    setScale((prev) => {
      if (prev > 1.0) {
        return 1.0;
      } else {
        return 2.0;
      }
    });
    setPosition({ x: 0, y: 0 });
  };

  const lastTapRef = useRef<number>(0);

  // Touch handlers (Swipe, Pinch, Drag, Swipe-down-to-close)
  const handleTouchStartAll = (e: React.TouchEvent) => {
    if (e.targetTouches.length === 2) {
      // Pinch to Zoom
      const dist = Math.hypot(
        e.targetTouches[0].clientX - e.targetTouches[1].clientX,
        e.targetTouches[0].clientY - e.targetTouches[1].clientY
      );
      setTouchStartDist(dist);
    } else if (e.targetTouches.length === 1) {
      const touch = e.targetTouches[0];
      
      // Double Tap detection
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleClick();
        e.preventDefault();
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (scale > 1.0) {
        // Dragging / Panning while zoomed
        setIsDragging(true);
        setTouchDragStart({
          x: touch.clientX - position.x,
          y: touch.clientY - position.y
        });
      } else {
        // swipe left/right & down-to-close detection
        touchStartXRef.current = touch.clientX;
        touchStartYRef.current = touch.clientY;
        setTouchStart(touch.clientX);
        setIsVerticalDragging(false);
        setTranslateY(0);
      }
    }
  };

  const handleTouchMoveAll = (e: React.TouchEvent) => {
    if (e.targetTouches.length === 2 && touchStartDist) {
      // Pinch scaling
      const dist = Math.hypot(
        e.targetTouches[0].clientX - e.targetTouches[1].clientX,
        e.targetTouches[0].clientY - e.targetTouches[1].clientY
      );
      const factor = dist / touchStartDist;
      setScale((prev) => Math.min(4.0, Math.max(0.6, prev * factor)));
      setTouchStartDist(dist);
    } else if (e.targetTouches.length === 1) {
      const touch = e.targetTouches[0];
      if (scale > 1.0 && isDragging) {
        // Panning image
        setPosition({
          x: touch.clientX - touchDragStart.x,
          y: touch.clientY - touchDragStart.y
        });
      } else if (scale === 1.0) {
        // Determine Swipe vs Pull down to close
        if (touchStartYRef.current !== null && touchStartXRef.current !== null) {
          const deltaX = touch.clientX - touchStartXRef.current;
          const deltaY = touch.clientY - touchStartYRef.current;

          // If swiped down significantly more than horizontal
          if (deltaY > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
            setIsVerticalDragging(true);
            setTranslateY(deltaY);
          } else if (!isVerticalDragging) {
            setTouchEnd(touch.clientX);
          }
        }
      }
    }
  };

  const handleTouchEndAll = () => {
    setTouchStartDist(null);
    setIsDragging(false);
    
    if (isVerticalDragging) {
      if (translateY > 120) {
        // Threshold passed -> Swipe down to Close
        handleClose();
      } else {
        // Snap back to normal
        setTranslateY(0);
      }
      setIsVerticalDragging(false);
      touchStartYRef.current = null;
      touchStartXRef.current = null;
      return;
    }

    if (scale === 1.0 && touchStart !== null && touchEnd !== null) {
      const distance = touchStart - touchEnd;
      if (Math.abs(distance) > 50) {
        if (distance > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
    touchStartYRef.current = null;
    touchStartXRef.current = null;
  };

  const handleDownload = async (photo: any) => {
    if (!photo.file_url) return;
    try {
      const response = await fetch(photo.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.file_name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download image", err);
      window.open(photo.file_url, '_blank');
    }
  };

  // Toast inside viewer for feedback
  const triggerViewerToast = (msg: string) => {
    setViewerToast(msg);
    setTimeout(() => {
      setViewerToast(prev => prev === msg ? null : prev);
    }, 2500);
  };

  // Favorite toggle implementation (admin favorites stored in user session storage/localstorage)
  const toggleFavorite = (photoId: string) => {
    if (!user) return;
    const isFav = favoriteIds.includes(photoId);
    let newFavs = [];
    if (isFav) {
      newFavs = favoriteIds.filter(id => id !== photoId);
      triggerViewerToast("Removed from Favorites");
    } else {
      newFavs = [...favoriteIds, photoId];
      triggerViewerToast("Added to Favorites ⭐");
    }
    setFavoriteIds(newFavs);
    localStorage.setItem(`vault_favorites_${user.id}`, JSON.stringify(newFavs));
  };

  // Move photo directly to folder
  const handleMovePhoto = async (photoId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ folder_id: folderId })
        .eq('id', photoId);
      if (error) throw error;
      
      const targetFolder = folderId ? allFolders.find(f => f.id === folderId) : null;
      setPhotos(prev => prev.map(p => 
        p.id === photoId 
          ? { ...p, folder_id: folderId, folders: targetFolder } 
          : p
      ));
      
      triggerViewerToast(folderId ? `Moved to folder "${targetFolder?.folder_name || 'Folder'}" 📁` : "Removed from folder");
    } catch (err) {
      console.error("Failed to move photo", err);
      triggerViewerToast("Failed to move photo");
    }
  };

  // Delete photo securely
  const handleDeletePhoto = async (photo: any) => {
    if (!confirm("Are you sure you want to permanently delete this photo? This cannot be undone.")) return;
    try {
      if (photo.storage_path) {
        await supabase.storage.from('photos').remove([photo.storage_path]);
      }
      
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);
      if (error) throw error;

      // Filter local lists
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      triggerViewerToast("Photo deleted 🗑");

      if (photos.length <= 1) {
        handleClose();
      } else {
        handleNext();
      }
    } catch (err) {
      console.error("Failed to delete photo", err);
      triggerViewerToast("Failed to delete photo");
    }
  };

  // Copy storage path to clipboard
  const handleCopyStoragePath = (path: string) => {
    if (!path) return;
    navigator.clipboard.writeText(path);
    triggerViewerToast("Storage path copied to clipboard! 📋");
  };

  // Open user profile inside lightbox
  const handleOpenUserProfile = async (userId: string) => {
    setViewingUser({ loading: true });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setViewingUser(data);
      } else {
        const photoUser = photos.find(p => p.user_id === userId)?.profiles;
        setViewingUser(photoUser || { full_name: 'Unknown Contributor', email: 'No email' });
      }
    } catch (err) {
      console.error("Failed to load user profile", err);
      const photoUser = photos.find(p => p.user_id === userId)?.profiles;
      setViewingUser(photoUser || { full_name: 'Unknown Contributor', email: 'No email' });
    }
  };

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

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true);
    const img = e.currentTarget;
    setImageResolution(`${img.naturalWidth} × ${img.naturalHeight} px`);
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center space-y-3 h-full min-h-[300px]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-semibold text-xs">Fetching latest PrivateVault uploads...</p>
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
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin PrivateVault Media</h1>
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
                setItemsPerPage(val === 'All' ? 'All' : Number(val));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value={6}>6 items</option>
              <option value={9}>9 items</option>
              <option value={15}>15 items</option>
              <option value={30}>30 items</option>
              <option value="All">All Photos</option>
            </select>
          </div>
        </div>

        {/* Content grid */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {paginatedPhotos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedPhotos.map((photo) => (
                <div 
                  key={photo.id} 
                  onClick={() => {
                    const photoIndex = photos.findIndex(p => p.id === photo.id);
                    if (photoIndex !== -1) {
                      setActivePhotoIndex(photoIndex);
                    }
                  }}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col hover:border-indigo-300 transition-all group cursor-pointer hover:shadow-md active:scale-[0.99]"
                >
                  {/* Image Thumbnail */}
                  <div className="relative aspect-[4/3] bg-slate-100 border-b border-slate-100 overflow-hidden">
                    {photo.file_url ? (
                      <img 
                        src={photo.file_url} 
                        alt={photo.file_name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        <ImageIcon size={32} />
                      </div>
                    )}

                    {/* Star Badge if in admin favorites list */}
                    {favoriteIds.includes(photo.id) && (
                      <div className="absolute top-3 right-3 bg-red-500/90 text-white p-1.5 rounded-full shadow-md z-10 animate-pulse">
                        <Heart size={12} className="fill-white text-white" />
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs truncate mb-1.5" title={photo.file_name}>
                        {photo.file_name}
                      </h4>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate font-semibold text-slate-700">
                            {photo.profiles?.full_name || 'Anonymous Contributor'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {photo.profiles?.email || 'No email associated'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3.5 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-400 font-medium">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          <span>{new Date(photo.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Folder size={11} />
                          <span className="truncate max-w-[120px]">
                            {photo.folders?.folder_name ? (
                              <span className="bg-indigo-50/80 text-indigo-600 px-2 py-0.5 rounded-full font-extrabold text-[9px] border border-indigo-100">
                                {photo.folders.folder_name}
                              </span>
                            ) : (
                              'No Folder'
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-1">
                          <HardDrive size={11} />
                          <span>
                            Size:{' '}
                            <strong className="text-indigo-600 font-bold">
                              {photo.size_mb ? `${photo.size_mb.toFixed(1)} MB` : '0.5 MB'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
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

      {/* Immersive Fullscreen Lightbox Overlay */}
      {activePhotoIndex !== null && photos[activePhotoIndex] && (() => {
        const currentPhoto = photos[activePhotoIndex];
        
        // Touch Drag Position style combined with vertical pull-down translate
        const transformStyle = {
          transform: `translate(${scale > 1.0 ? position.x : 0}px, ${scale > 1.0 ? position.y : translateY}px) scale(${scale})`,
          opacity: isVerticalDragging ? Math.max(0.4, 1 - translateY / 350) : 1,
          transition: isDragging || isVerticalDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s',
        };

        return (
          <div 
            id="immersive-gallery-viewer"
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200 pb-safe pt-safe"
          >
            {/* Top Bar */}
            <div className="h-16 px-4 bg-slate-900/60 border-b border-white/5 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-white font-extrabold text-xs sm:text-sm tracking-tight bg-white/10 px-3 py-1.5 rounded-xl">
                  {activePhotoIndex + 1} / {photos.length}
                </span>
                
                {/* Fullscreen control indicator */}
                <span className="hidden sm:inline-flex text-[10px] text-slate-400 font-semibold bg-white/5 px-2 py-1 rounded-lg">
                  Press [F] Fullscreen
                </span>
              </div>
              
              {/* Zoom & Action Controls */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  onClick={handleZoomOut}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 rounded-xl transition-all"
                  title="Zoom Out [-]"
                >
                  <ZoomOut size={18} />
                </button>
                <button 
                  onClick={handleResetZoom}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 rounded-xl transition-all"
                  title="Reset Zoom [0]"
                >
                  <RotateCcw size={16} />
                </button>
                <button 
                  onClick={handleZoomIn}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 rounded-xl transition-all"
                  title="Zoom In [+]"
                >
                  <ZoomIn size={18} />
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button 
                  onClick={() => handleDownload(currentPhoto)}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 rounded-xl transition-all"
                  title="Download File"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={handleClose}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 active:scale-95 rounded-xl transition-all ml-1"
                  title="Close Gallery (ESC)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Interactive Stage Area */}
            <div 
              ref={imgContainerRef}
              className="flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing bg-black/10"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStartAll}
              onTouchMove={handleTouchMoveAll}
              onTouchEnd={handleTouchEndAll}
              onDoubleClick={handleDoubleClick}
            >
              {/* Left Desktop Trigger Area */}
              <div 
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-0 top-0 bottom-0 w-24 hidden md:flex items-center justify-center text-white/10 hover:text-white/70 hover:bg-white/5 cursor-pointer z-10 transition-all duration-150"
              >
                <ChevronLeft size={44} className="stroke-[2.5]" />
              </div>

              {/* Status Indicator / Loading Overlay */}
              {!imageLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-slate-950/40 z-20">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Loading high resolution file...</span>
                </div>
              )}

              {/* Progressive loading blur technique behind high-res */}
              {!imageLoaded && currentPhoto.file_url && (
                <img 
                  src={currentPhoto.file_url} 
                  alt="cached-placeholder" 
                  className="absolute max-h-[60vh] max-w-[88vw] object-contain blur-2xl opacity-40 scale-95 transition-opacity"
                />
              )}

              {/* Responsive Styled Image tag */}
              <img 
                src={currentPhoto.file_url} 
                alt={currentPhoto.file_name}
                referrerPolicy="no-referrer"
                onLoad={handleImageLoad}
                style={transformStyle}
                className={`max-h-[60vh] max-w-[88vw] object-contain select-none pointer-events-none rounded-sm shadow-2xl transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Right Desktop Trigger Area */}
              <div 
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-0 top-0 bottom-0 w-24 hidden md:flex items-center justify-center text-white/10 hover:text-white/70 hover:bg-white/5 cursor-pointer z-10 transition-all duration-150"
              >
                <ChevronRight size={44} className="stroke-[2.5]" />
              </div>

              {/* Temporary Floating Viewer Alert / Toast Notification */}
              {viewerToast && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-indigo-600/90 text-white border border-indigo-500 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                  <Shield size={14} className="animate-pulse" />
                  <span>{viewerToast}</span>
                </div>
              )}
            </div>

            {/* Bottom filmstrip thumbnail row */}
            <div className="bg-slate-900/40 border-t border-white/5 py-3.5 z-10 shrink-0">
              <div 
                id="filmstrip-container"
                className="max-w-2xl mx-auto flex items-center justify-start sm:justify-center gap-2.5 overflow-x-auto px-4 scrollbar-none scroll-smooth py-1"
              >
                {photos.map((photoItem, index) => {
                  const isActive = index === activePhotoIndex;
                  return (
                    <button
                      key={photoItem.id}
                      id={`filmstrip-thumb-${index}`}
                      onClick={() => setActivePhotoIndex(index)}
                      className={`relative shrink-0 w-11 h-11 rounded-xl overflow-hidden border-2 transition-all ${
                        isActive 
                          ? 'border-indigo-500 scale-110 shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/10' 
                          : 'border-transparent opacity-40 hover:opacity-80'
                      }`}
                    >
                      <img 
                        src={photoItem.file_url} 
                        alt="thumb" 
                        className="w-full h-full object-cover pointer-events-none" 
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Collapsible Sheet */}
            <div 
              className={`bg-slate-900/95 border-t border-white/5 backdrop-blur-md text-white z-10 shrink-0 transition-all duration-300 ${
                isSheetExpanded ? 'pb-8 pt-4 px-4 sm:px-6' : 'py-3 px-4'
              }`}
            >
              <div className="max-w-2xl mx-auto">
                {/* Drag handle / toggle bar */}
                <button 
                  onClick={() => setIsSheetExpanded(!isSheetExpanded)}
                  className="w-full flex flex-col items-center justify-center pb-2 text-slate-400 hover:text-white transition-colors group focus:outline-none"
                >
                  <div className="w-10 h-1 bg-white/15 rounded-full mb-1 group-hover:bg-white/30"></div>
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isSheetExpanded ? (
                      <>
                        <ChevronDown size={11} />
                        <span>Collapse Info</span>
                      </>
                    ) : (
                      <>
                        <ChevronUp size={11} />
                        <span>Swipe/Click to Expand Info & Actions</span>
                      </>
                    )}
                  </div>
                </button>

                {/* Collapsed Info Row */}
                {!isSheetExpanded && (
                  <div className="flex items-center justify-between text-xs text-slate-300 py-1">
                    <div className="truncate pr-4 flex-1">
                      <span className="font-extrabold text-white block truncate text-xs sm:text-sm">{currentPhoto.file_name}</span>
                      <span className="text-[11px] text-slate-400">by {currentPhoto.profiles?.full_name || 'Anonymous User'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleFavorite(currentPhoto.id)}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                        title="Favorite"
                      >
                        <Heart size={14} className={favoriteIds.includes(currentPhoto.id) ? 'fill-red-500 text-red-500' : 'text-slate-300'} />
                      </button>
                      <button 
                        onClick={() => setIsSheetExpanded(true)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold px-3 py-1.5 transition-all shadow-md shadow-indigo-600/10"
                      >
                        Actions
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Sheet Info & Actions Grid */}
                {isSheetExpanded && (
                  <div className="space-y-4 animate-in slide-in-from-bottom duration-300">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between items-start border-b border-white/5 pb-3.5 gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">Secure PrivateVault Media File</span>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-100 truncate" title={currentPhoto.file_name}>
                          {currentPhoto.file_name}
                        </h2>
                        <span className="text-xs text-slate-400 block truncate mt-0.5">Contributor: {currentPhoto.profiles?.full_name || 'Anonymous User'}</span>
                      </div>
                      
                      {/* Action Tools Row */}
                      <div className="flex gap-1.5 shrink-0 w-full sm:w-auto">
                        <button 
                          onClick={() => toggleFavorite(currentPhoto.id)}
                          className={`flex-1 sm:flex-none p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                            favoriteIds.includes(currentPhoto.id) 
                              ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25' 
                              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                          title={favoriteIds.includes(currentPhoto.id) ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Heart size={16} className={favoriteIds.includes(currentPhoto.id) ? 'fill-red-500' : ''} />
                        </button>
                        <button 
                          onClick={() => setIsMovingFolder(true)}
                          className="flex-1 sm:flex-none p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center"
                          title="Move to Folder"
                        >
                          <FolderOpen size={16} />
                        </button>
                        <button 
                          onClick={() => handleCopyStoragePath(currentPhoto.storage_path)}
                          className="flex-1 sm:flex-none p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center"
                          title="Copy Storage Path"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={() => handleOpenUserProfile(currentPhoto.user_id)}
                          className="flex-1 sm:flex-none p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-indigo-400 hover:text-indigo-300 transition-all flex items-center justify-center"
                          title="Open User Profile"
                        >
                          <User size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeletePhoto(currentPhoto)}
                          className="flex-1 sm:flex-none p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/20 rounded-xl text-red-400 transition-all flex items-center justify-center"
                          title="Delete Photo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata details and info boxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Left box */}
                      <div className="bg-white/5 rounded-2xl p-3.5 space-y-2 border border-white/5 text-xs">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Mail size={13} className="text-indigo-400 shrink-0" />
                          <span className="truncate" title={currentPhoto.profiles?.email}>
                            Email: <strong className="text-white font-semibold">{currentPhoto.profiles?.email || 'No email associated'}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Clock size={13} className="text-indigo-400 shrink-0" />
                          <span>
                            Uploaded: <strong className="text-white font-semibold">{new Date(currentPhoto.uploaded_at).toLocaleDateString()}</strong> at <strong className="text-white font-semibold">{new Date(currentPhoto.uploaded_at).toLocaleTimeString()}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Folder size={13} className="text-indigo-400 shrink-0" />
                          <span>
                            Folder:{' '}
                            {currentPhoto.folders?.folder_name ? (
                              <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                                {currentPhoto.folders.folder_name}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">None (General PrivateVault)</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Right box */}
                      <div className="bg-white/5 rounded-2xl p-3.5 space-y-2 border border-white/5 text-xs">
                        <div className="flex items-center gap-2 text-slate-300">
                          <HardDrive size={13} className="text-indigo-400 shrink-0" />
                          <span>
                            File Size:{' '}
                            <strong className="text-emerald-400 font-semibold">
                              {currentPhoto.size_mb ? `${currentPhoto.size_mb.toFixed(1)} MB` : '0.5 MB'}
                            </strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Info size={13} className="text-indigo-400 shrink-0" />
                          <span>
                            Resolution: <strong className="text-indigo-300 font-semibold">{imageResolution}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <ExternalLink size={13} className="text-indigo-400/70 shrink-0" />
                          <span className="truncate" title={currentPhoto.storage_path}>
                            Path: <code className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-indigo-300 font-mono">{currentPhoto.storage_path}</code>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom User Profile Modal Overlay (inside the viewer, without closing it) */}
            {viewingUser && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                  <button 
                    onClick={() => setViewingUser(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  
                  {viewingUser.loading ? (
                    <div className="py-8 flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading profile details...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center text-center space-y-2">
                        <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
                          <User size={32} />
                        </div>
                        <h3 className="text-base font-black text-white">{viewingUser.full_name || 'Anonymous User'}</h3>
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-400/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {viewingUser.role || 'Contributor'}
                        </span>
                      </div>

                      <div className="space-y-3 pt-2 text-sm text-slate-300">
                        <div className="flex items-center gap-2.5 bg-white/5 p-2.5 rounded-2xl border border-white/5">
                          <Mail size={14} className="text-indigo-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Email Address</span>
                            <span className="truncate block font-medium text-xs text-white">{viewingUser.email || 'No email provided'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-white/5 p-2.5 rounded-2xl border border-white/5">
                          <UserCheck size={14} className="text-indigo-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Mobile Number</span>
                            <span className="truncate block font-medium text-xs text-white">{viewingUser.mobile_number || 'Not provided'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-white/5 p-2.5 rounded-2xl border border-white/5">
                          <Clock size={14} className="text-indigo-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Member Since</span>
                            <span className="truncate block font-medium text-xs text-white">
                              {viewingUser.created_at ? new Date(viewingUser.created_at).toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setViewingUser(null)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all mt-2"
                      >
                        Close Profile
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Move to Folder Dropdown Modal (inside the viewer, without closing it) */}
            {isMovingFolder && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                  <button 
                    onClick={() => setIsMovingFolder(false)}
                    className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <FolderOpen size={18} className="text-indigo-400" />
                      <span>Move to Folder</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">Select a folder to assign this photo to, or remove it from folders.</p>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 py-1">
                    <button 
                      onClick={() => {
                        handleMovePhoto(currentPhoto.id, null);
                        setIsMovingFolder(false);
                      }}
                      className={`w-full text-left p-3 rounded-2xl flex items-center justify-between text-xs font-bold border transition-all ${
                        !currentPhoto.folder_id 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span>General PrivateVault (No Folder)</span>
                      {!currentPhoto.folder_id && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                    </button>

                    {allFolders.map(folder => {
                      const isSelected = currentPhoto.folder_id === folder.id;
                      return (
                        <button 
                          key={folder.id}
                          onClick={() => {
                            handleMovePhoto(currentPhoto.id, folder.id);
                            setIsMovingFolder(false);
                          }}
                          className={`w-full text-left p-3 rounded-2xl flex items-center justify-between text-xs font-bold border transition-all ${
                            isSelected 
                              ? 'bg-indigo-600 border-indigo-500 text-white' 
                              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>{folder.folder_name}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                        </button>
                      );
                    })}

                    {allFolders.length === 0 && (
                      <p className="text-center text-xs text-slate-500 py-4 italic">No folders created yet.</p>
                    )}
                  </div>

                  <button 
                    onClick={() => setIsMovingFolder(false)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>
        );
      })()}
    </div>
  );
};
