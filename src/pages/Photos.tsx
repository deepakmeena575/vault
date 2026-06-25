import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import { supabase } from '../lib/supabase';
import { Photo, Folder } from '../types';
import { 
  Image as ImageIcon, 
  UploadCloud, 
  Trash2, 
  Plus, 
  Folder as FolderIcon, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Check, 
  X, 
  ChevronDown,
  Calendar,
  FolderPlus,
  Heart,
  ArrowLeft,
  MoreVertical,
  FolderOpen,
  Share2,
  Download,
  CheckCircle2,
  Filter,
  SlidersHorizontal,
  Loader2,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { optimizeImage, checkDuplicateUpload, getOriginalStoragePath, validateFile } from '../lib/optimization';
import { populatePhotosWithSignedUrls, getSignedUrl } from '../lib/signedUrlCache';

// Static caches to prevent re-generating signed URLs during tab changes/scrolls
const folderCoverCache = new Map<string, string>();

interface UploadQueueItem {
  id: string;
  fileName: string;
  file: File;
  status: 'pending' | 'compressing' | 'uploading' | 'saving' | 'success' | 'failed' | 'duplicate' | 'invalid_type' | 'too_large';
  progress: number;
}

const ITEMS_PER_PAGE = 50;

type ActiveTab = 'photos' | 'albums' | 'favorites' | 'trash';

interface PhotosProps {
  activeTab?: ActiveTab;
}

export const Photos: React.FC<PhotosProps> = ({ activeTab = 'photos' }) => {
  const { user } = useAuth();
  const { uploadMode, userPin } = useSecurity();
  const navigate = useNavigate();
  
  // Secure Lock States
  const [lockedFolderIds, setLockedFolderIds] = useState<string[]>([]);
  const [unlockedFolderIds, setUnlockedFolderIds] = useState<string[]>([]);
  const [activePinChallengeFolderId, setActivePinChallengeFolderId] = useState<string | null>(null);
  const [pinChallengeInput, setPinChallengeInput] = useState<string>('');
  const [pinChallengeError, setPinChallengeError] = useState<string>('');
  const [showNoPinModal, setShowNoPinModal] = useState<boolean>(false);

  // Load locked folders from localStorage
  useEffect(() => {
    if (user) {
      const savedLocked = localStorage.getItem(`vault_locked_folders_${user.id}`);
      if (savedLocked) {
        setLockedFolderIds(JSON.parse(savedLocked));
      }
    }
  }, [user]);

  const toggleFolderLock = (folderId: string) => {
    if (!user) return;
    let updated: string[];
    if (lockedFolderIds.includes(folderId)) {
      updated = lockedFolderIds.filter(id => id !== folderId);
      setUnlockedFolderIds(prev => prev.filter(id => id !== folderId));
    } else {
      updated = [...lockedFolderIds, folderId];
    }
    setLockedFolderIds(updated);
    localStorage.setItem(`vault_locked_folders_${user.id}`, JSON.stringify(updated));
  };

  const handleFolderClick = (folder: Folder) => {
    if (lockedFolderIds.includes(folder.id) && !unlockedFolderIds.includes(folder.id)) {
      setActivePinChallengeFolderId(folder.id);
      setPinChallengeInput('');
      setPinChallengeError('');
    } else {
      navigate('/folders/' + folder.id);
    }
  };

  const handleVerifyFolderPin = (digit: string) => {
    const newVal = pinChallengeInput + digit;
    if (newVal.length > 4) return;
    setPinChallengeInput(newVal);
    setPinChallengeError('');

    if (newVal === userPin) {
      // Success!
      if (activePinChallengeFolderId) {
        setUnlockedFolderIds(prev => [...prev, activePinChallengeFolderId]);
        const targetId = activePinChallengeFolderId;
        setActivePinChallengeFolderId(null);
        setPinChallengeInput('');
        navigate('/folders/' + targetId);
      }
    } else if (newVal.length === 4) {
      setTimeout(() => {
        setPinChallengeError('Incorrect PIN code');
        setPinChallengeInput('');
      }, 150);
    }
  };

  const handleCancelPinChallenge = () => {
    setActivePinChallengeFolderId(null);
    setPinChallengeInput('');
    setPinChallengeError('');
    if (selectedFolder) {
      navigate('/folders');
    }
  };

  const handleToggleFolderLock = (folderId: string) => {
    setShowFolderMenuId(null);
    if (!userPin) {
      setShowNoPinModal(true);
      return;
    }
    toggleFolderLock(folderId);
  };
  
  // Navigation & Workspace State
  const [selectedFolder, setSelectedFolder] = useState<string>('');

  // Sync selected folder with url
  const { albumId } = useParams<{ albumId?: string }>();
  useEffect(() => {
    if (albumId) {
      setSelectedFolder(albumId);
      // Auto-trigger PIN challenge if selected folder is locked and not unlocked
      if (lockedFolderIds.includes(albumId) && !unlockedFolderIds.includes(albumId)) {
        setActivePinChallengeFolderId(albumId);
        setPinChallengeInput('');
        setPinChallengeError('');
      }
    } else {
      setSelectedFolder('');
    }
  }, [albumId, lockedFolderIds, unlockedFolderIds]);
  
  // Core Database States
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [folderCovers, setFolderCovers] = useState<Record<string, string>>({});
  
  // Favorites & Trash LocalStorage Sync
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [trashIds, setTrashIds] = useState<string[]>([]);

  // Multi-Select States
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [showMoveDropdown, setShowMoveDropdown] = useState<boolean>(false);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest'); // 'newest' | 'oldest' | 'name_asc' | 'name_desc'
  const [showSortOptions, setShowSortOptions] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'all' | 'recent' | 'videos'>('all');

  // Pagination & Lazy Scrolling
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingPhotos, setLoadingPhotos] = useState<boolean>(false);

  // Upload Systems
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [showFABSheet, setShowFABSheet] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Full-Screen Immersive Viewer States
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Folder Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [showFolderMenuId, setShowFolderMenuId] = useState<string | null>(null);

  // Press Detection Refs for mobile long-press selection
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  // Lazy loading Intersection Observer Target
  const observerTarget = useRef<HTMLDivElement>(null);

  // Mobile pull-to-refresh states & refs
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || el.scrollTop !== 0) return;
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPulling) return;
    const el = containerRef.current;
    if (!el) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      const distance = Math.min(diff * 0.4, 80);
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance > 55) {
      setRefreshing(true);
      setPullDistance(35);
      try {
        await fetchPhotos(true);
      } catch (err) {
        console.error(err);
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  // Alert system for robust user feedback
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const triggerAlert = (text: string, type: 'success' | 'error' | 'info' = 'error') => {
    setAlert({ type, text });
    setTimeout(() => {
      setAlert(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  // Reset Multi-select selection and filters when context shifts
  useEffect(() => {
    setSelectedPhotoIds([]);
    setShowMoveDropdown(false);
    setFilterType('all');
  }, [activeTab, selectedFolder]);

  // Load favorites & trash on mount
  useEffect(() => {
    if (user) {
      const savedFavorites = localStorage.getItem(`vault_favorites_${user.id}`);
      const savedTrash = localStorage.getItem(`vault_trash_${user.id}`);
      if (savedFavorites) setFavoriteIds(JSON.parse(savedFavorites));
      if (savedTrash) setTrashIds(JSON.parse(savedTrash));
    }
  }, [user]);

  // Sync state helpers
  const updateFavoritesList = (newFavorites: string[]) => {
    setFavoriteIds(newFavorites);
    if (user) {
      localStorage.setItem(`vault_favorites_${user.id}`, JSON.stringify(newFavorites));
    }
  };

  const updateTrashList = (newTrash: string[]) => {
    setTrashIds(newTrash);
    if (user) {
      localStorage.setItem(`vault_trash_${user.id}`, JSON.stringify(newTrash));
    }
  };

  // Fetch initial folders
  useEffect(() => {
    if (user) {
      fetchFolders();
    }
  }, [user]);

  // Reload photos when dependencies change
  useEffect(() => {
    if (user) {
      fetchPhotos(true);
      fetchFolderCounts();
    }
  }, [user, selectedFolder, sortBy, activeTab, favoriteIds, trashIds, filterType]);

  // Debounce search input
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (user) {
        fetchPhotos(true);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Setup Keyboard shortcuts for Fullscreen Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewerIndex === null) return;
      if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'Escape') {
        closeViewer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerIndex, photos]);

  // Intersection Observer for Infinite Scrolling
  useEffect(() => {
    if (!observerTarget.current || !hasMore || loadingPhotos) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePhotos();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [observerTarget.current, hasMore, loadingPhotos]);

  // Folders and counts fetching
  const fetchFolders = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) {
        setFolders(data);
        fetchFolderCovers(data);
      }
    } catch (e) {
      console.error("Failed to fetch folders", e);
    }
  };

  const fetchFolderCounts = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('photos')
        .select('id, folder_id')
        .eq('user_id', user.id);
      
      if (data) {
        const counts: Record<string, number> = {};
        const activePhotos = data.filter(p => !trashIds.includes(p.id));
        activePhotos.forEach((p: any) => {
          if (p.folder_id) {
            counts[p.folder_id] = (counts[p.folder_id] || 0) + 1;
          }
        });
        setFolderCounts(counts);
      }
    } catch (e) {
      console.error("Failed folder counts check", e);
    }
  };

  const fetchFolderCovers = async (foldersList: Folder[]) => {
    const coversToFetch = foldersList.filter(f => !folderCoverCache.has(f.id));
    const updatedCovers = { ...folderCovers };

    foldersList.forEach(f => {
      if (folderCoverCache.has(f.id)) {
        updatedCovers[f.id] = folderCoverCache.get(f.id)!;
      }
    });

    if (coversToFetch.length > 0) {
      try {
        await Promise.all(coversToFetch.map(async (folder) => {
          const { data, error } = await supabase
            .from('photos')
            .select('storage_path')
            .eq('folder_id', folder.id)
            .limit(1);

          if (!error && data && data.length > 0 && data[0].storage_path) {
            const path = data[0].storage_path;
            const signedUrl = await getSignedUrl(path, 3600);
            
            if (signedUrl) {
              folderCoverCache.set(folder.id, signedUrl);
              updatedCovers[folder.id] = signedUrl;
            }
          }
        }));
      } catch (err) {
        console.error("Error loading covers", err);
      }
    }
    setFolderCovers(updatedCovers);
  };

  // Signed URL caching & Batch loader
  const getSignedUrlsForPhotos = async (photosList: Photo[]): Promise<Photo[]> => {
    return populatePhotosWithSignedUrls(photosList);
  };

  const fetchPhotos = async (reset: boolean = false) => {
    if (!user) return;
    setLoadingPhotos(true);
    
    const currentPage = reset ? 0 : page;
    const fromIndex = currentPage * ITEMS_PER_PAGE;
    const toIndex = fromIndex + ITEMS_PER_PAGE - 1;

    try {
      let query = supabase
        .from('photos')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (selectedFolder) {
        query = query.eq('folder_id', selectedFolder);
      }

      if (activeTab === 'favorites') {
        if (favoriteIds.length > 0) {
          query = query.in('id', favoriteIds);
        } else {
          setPhotos([]);
          setHasMore(false);
          setLoadingPhotos(false);
          return;
        }
      }

      if (activeTab === 'trash') {
        if (trashIds.length > 0) {
          query = query.in('id', trashIds);
        } else {
          setPhotos([]);
          setHasMore(false);
          setLoadingPhotos(false);
          return;
        }
      } else {
        if (trashIds.length > 0) {
          query = query.not('id', 'in', `(${trashIds.join(',')})`);
        }
      }

      if (searchQuery.trim()) {
        query = query.ilike('file_name', `%${searchQuery.trim()}%`);
      }

      // Quick filter conditions
      if (activeTab === 'photos' && !selectedFolder) {
        if (filterType === 'recent') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          query = query.gte('uploaded_at', sevenDaysAgo);
        } else if (filterType === 'videos') {
          query = query.or('file_name.ilike.%.mp4,file_name.ilike.%.mov,file_name.ilike.%.webm,file_name.ilike.%.avi,file_name.ilike.%.m4v,file_name.ilike.%.mkv');
        }
      }

      if (sortBy === 'newest') {
        query = query.order('uploaded_at', { ascending: false });
      } else if (sortBy === 'oldest') {
        query = query.order('uploaded_at', { ascending: true });
      } else if (sortBy === 'name_asc') {
        query = query.order('file_name', { ascending: true });
      } else if (sortBy === 'name_desc') {
        query = query.order('file_name', { ascending: false });
      }

      query = query.range(fromIndex, toIndex);

      const { data, count, error } = await query;

      if (error) throw error;

      if (data) {
        const resolvedPhotos = await getSignedUrlsForPhotos(data);

        if (reset) {
          setPhotos(resolvedPhotos);
          setPage(1);
        } else {
          setPhotos(prev => {
            const prevIds = new Set(prev.map(p => p.id));
            const uniqueNew = resolvedPhotos.filter(p => !prevIds.has(p.id));
            return [...prev, ...uniqueNew];
          });
          setPage(currentPage + 1);
        }

        const totalCount = count || 0;
        setHasMore(fromIndex + resolvedPhotos.length < totalCount);
      }
    } catch (err) {
      console.error("Photos loaded failed", err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const loadMorePhotos = () => {
    if (!loadingPhotos && hasMore) {
      fetchPhotos(false);
    }
  };

  // Upload Batch
  const uploadFilesBatch = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    setShowFABSheet(false);

    const newQueueItems: UploadQueueItem[] = Array.from(files).map((f: any, idx) => ({
      id: `${Date.now()}-${idx}`,
      fileName: f.name,
      file: f,
      status: 'pending',
      progress: 0,
    }));

    setUploadQueue(prev => [...newQueueItems, ...prev]);

    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];
      if (!currentFile) continue;
      const queueItem = newQueueItems[i];

      const updateStatus = (status: UploadQueueItem['status'], progress: number) => {
        setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status, progress } : item));
      };

      try {
        // 0. Validate file format and size
        const validation = validateFile(currentFile);
        if (!validation.isValid) {
          updateStatus(validation.reason!, 100);
          continue;
        }

        // 1. Detect duplicates to save storage space
        updateStatus('pending', 10);
        const isDuplicate = await checkDuplicateUpload(user.id, currentFile.name);
        if (isDuplicate) {
          updateStatus('duplicate', 100);
          continue;
        }

        // 2. Perform WebP compression and quality adjustments
        updateStatus('compressing', 35);
        const optimized = await optimizeImage(currentFile, uploadMode);

        updateStatus('uploading', 65);
        const uniqueName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
        const fileExt = currentFile.name.split('.').pop() || 'jpg';
        const previewPath = `${user.id}/preview_${uniqueName}.webp`;
        const originalPath = uploadMode === 'saver'
          ? previewPath
          : `${user.id}/original_${uniqueName}_${fileExt}`;

        // Upload optimized preview
        const { error: previewUploadError } = await supabase.storage
          .from('photos')
          .upload(previewPath, optimized.preview, { 
            cacheControl: '31536000, immutable',
            upsert: false 
          });

        if (previewUploadError) throw previewUploadError;

        // Upload original if different
        if (uploadMode !== 'saver') {
          const { error: originalUploadError } = await supabase.storage
            .from('photos')
            .upload(originalPath, optimized.original, { 
              cacheControl: '31536000, immutable',
              upsert: false 
            });
          if (originalUploadError) throw originalUploadError;
        }

        updateStatus('saving', 85);

        const insertPayload: any = {
          user_id: user.id,
          file_name: currentFile.name,
          storage_path: previewPath,
          file_url: null
        };

        if (selectedFolder) {
          insertPayload.folder_id = selectedFolder;
        }

        const { error: insertError } = await supabase
          .from('photos')
          .insert(insertPayload);

        if (insertError) throw insertError;

        updateStatus('success', 100);
      } catch (err: any) {
        console.error("Upload failed", err);
        updateStatus('failed', 0);
        triggerAlert(`Failed to upload "${currentFile.name}"`);
      }
    }

    setUploading(false);
    fetchPhotos(true);
    fetchFolderCounts();

    setTimeout(() => {
      setUploadQueue([]);
    }, 5000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFilesBatch(e.target.files);
    }
  };

  const handleRetryFailedUploads = () => {
    const failedItems = uploadQueue.filter(item => item.status === 'failed');
    if (failedItems.length === 0) return;
    
    const filesToRetry = failedItems.map(item => item.file);
    // Clear failed items from current queue
    setUploadQueue(prev => prev.filter(item => item.status !== 'failed'));
    uploadFilesBatch(filesToRetry);
  };

  const uploadFilesBatchWithTargetFolder = async (files: File[], targetFolderId: string) => {
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    setShowFABSheet(false);

    const newQueueItems: UploadQueueItem[] = files.map((f, idx) => ({
      id: `${Date.now()}-${idx}`,
      fileName: f.name,
      file: f,
      status: 'pending',
      progress: 0,
    }));

    setUploadQueue(prev => [...newQueueItems, ...prev]);

    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];
      if (!currentFile) continue;
      const queueItem = newQueueItems[i];

      const updateStatus = (status: UploadQueueItem['status'], progress: number) => {
        setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status, progress } : item));
      };

      try {
        // 0. Validate file format and size
        const validation = validateFile(currentFile);
        if (!validation.isValid) {
          updateStatus(validation.reason!, 100);
          continue;
        }

        // 1. Detect duplicates
        updateStatus('pending', 10);
        const isDuplicate = await checkDuplicateUpload(user.id, currentFile.name);
        if (isDuplicate) {
          updateStatus('duplicate', 100);
          continue;
        }

        // 2. Perform intelligent compression
        updateStatus('compressing', 35);
        const optimized = await optimizeImage(currentFile, uploadMode);

        updateStatus('uploading', 65);
        const uniqueName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
        const fileExt = currentFile.name.split('.').pop() || 'jpg';
        const previewPath = `${user.id}/preview_${uniqueName}.webp`;
        const originalPath = uploadMode === 'saver'
          ? previewPath
          : `${user.id}/original_${uniqueName}_${fileExt}`;

        // Upload optimized preview
        const { error: previewUploadError } = await supabase.storage
          .from('photos')
          .upload(previewPath, optimized.preview, { 
            cacheControl: '31536000, immutable',
            upsert: false 
          });

        if (previewUploadError) throw previewUploadError;

        // Upload original if different
        if (uploadMode !== 'saver') {
          const { error: originalUploadError } = await supabase.storage
            .from('photos')
            .upload(originalPath, optimized.original, { 
              cacheControl: '31536000, immutable',
              upsert: false 
            });
          if (originalUploadError) throw originalUploadError;
        }

        updateStatus('saving', 85);

        const insertPayload: any = {
          user_id: user.id,
          file_name: currentFile.name,
          storage_path: previewPath,
          file_url: null,
          folder_id: targetFolderId
        };

        const { error: insertError } = await supabase
          .from('photos')
          .insert(insertPayload);

        if (insertError) throw insertError;

        updateStatus('success', 100);
      } catch (err: any) {
        console.error("Upload folder file failed", err);
        updateStatus('failed', 0);
        triggerAlert(`Failed to upload "${currentFile.name}"`);
      }
    }

    setUploading(false);
    await fetchFolders();
    fetchPhotos(true);
    fetchFolderCounts();

    setTimeout(() => {
      setUploadQueue([]);
    }, 5000);
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    const filesArray = Array.from(e.target.files) as File[];
    const firstFile = filesArray[0] as any;
    let folderName = 'Uploaded Folder';
    if (firstFile && firstFile.webkitRelativePath) {
      const parts = firstFile.webkitRelativePath.split('/');
      if (parts.length > 0 && parts[0]) {
        folderName = parts[0];
      }
    }

    setUploading(true);
    setShowFABSheet(false);

    try {
      const { data: newFolder, error: folderError } = await supabase
        .from('folders')
        .insert([{ user_id: user.id, folder_name: folderName }])
        .select()
        .single();

      if (folderError) throw folderError;

      if (newFolder) {
        await uploadFilesBatchWithTargetFolder(filesArray, newFolder.id);
        navigate('/folders/' + newFolder.id);
      }
    } catch (err) {
      console.error("Folder upload creation failed", err);
      uploadFilesBatch(filesArray);
    } finally {
      setUploading(false);
    }
  };

  // Modern Long Press Trigger logic for Mobile-First Selection
  const startPressTimer = (photoId: string) => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      handleSelectPhoto(photoId);
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 550);
  };

  const cancelPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handlePhotoTap = (photoId: string, index: number) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    // If multi-select is active, single tap toggles selection
    if (selectedPhotoIds.length > 0) {
      handleSelectPhoto(photoId);
    } else {
      // Open fullscreen viewer
      openViewer(index);
    }
  };

  const handleSelectPhoto = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      if (prev.includes(photoId)) {
        return prev.filter(id => id !== photoId);
      } else {
        return [...prev, photoId];
      }
    });
  };

  // Bulk Actions Handlers
  const handleBulkFavorite = () => {
    const alreadyFavorites = selectedPhotoIds.every(id => favoriteIds.includes(id));
    let newFavorites = [...favoriteIds];
    if (alreadyFavorites) {
      newFavorites = favoriteIds.filter(fId => !selectedPhotoIds.includes(fId));
    } else {
      const set = new Set([...favoriteIds, ...selectedPhotoIds]);
      newFavorites = Array.from(set);
    }
    updateFavoritesList(newFavorites);
    setSelectedPhotoIds([]);
  };

  const handleBulkMoveToTrash = () => {
    const uniqueTrashSet = new Set([...trashIds, ...selectedPhotoIds]);
    const newTrash = Array.from(uniqueTrashSet);
    updateTrashList(newTrash);

    // Remove from favorites
    const newFavorites = favoriteIds.filter(fId => !selectedPhotoIds.includes(fId));
    updateFavoritesList(newFavorites);

    // Update state
    setPhotos(prev => prev.filter(p => !selectedPhotoIds.includes(p.id)));
    setSelectedPhotoIds([]);
    fetchFolderCounts();
  };

  const handleBulkRestore = () => {
    const newTrash = trashIds.filter(tId => !selectedPhotoIds.includes(tId));
    updateTrashList(newTrash);
    setPhotos(prev => prev.filter(p => !selectedPhotoIds.includes(p.id)));
    setSelectedPhotoIds([]);
    fetchFolderCounts();
  };

  const handleBulkPermanentDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete these ${selectedPhotoIds.length} photos? This cannot be undone.`)) {
      return;
    }

    try {
      const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));
      const storagePaths = selectedPhotos.map(p => p.storage_path).filter(Boolean);

      if (storagePaths.length > 0) {
        await supabase.storage.from('photos').remove(storagePaths);
      }

      const { error } = await supabase
        .from('photos')
        .delete()
        .in('id', selectedPhotoIds);

      if (error) throw error;

      updateTrashList(trashIds.filter(tId => !selectedPhotoIds.includes(tId)));
      updateFavoritesList(favoriteIds.filter(fId => !selectedPhotoIds.includes(fId)));
      setPhotos(prev => prev.filter(p => !selectedPhotoIds.includes(p.id)));
      setSelectedPhotoIds([]);
      fetchFolderCounts();
    } catch (e) {
      console.error("Bulk delete failed", e);
    }
  };

  const handleBulkMoveToFolder = async (targetFolderId: string | null) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ folder_id: targetFolderId })
        .in('id', selectedPhotoIds);

      if (error) throw error;

      fetchPhotos(true);
      fetchFolderCounts();
      setSelectedPhotoIds([]);
      setShowMoveDropdown(false);
    } catch (err) {
      console.error("Bulk move failed", err);
    }
  };

  const handleBulkDownload = async () => {
    const downloadList = photos.filter(p => selectedPhotoIds.includes(p.id));
    if (downloadList.length === 0) return;

    for (let i = 0; i < downloadList.length; i++) {
      const photo = downloadList[i];
      try {
        const originalPath = getOriginalStoragePath(photo);
        const signedUrl = await getSignedUrl(originalPath, 60);

        if (signedUrl) {
          await new Promise(r => setTimeout(r, 150));
          const trigger = document.createElement('a');
          trigger.href = signedUrl;
          trigger.download = photo.file_name;
          trigger.target = '_blank';
          document.body.appendChild(trigger);
          trigger.click();
          document.body.removeChild(trigger);
        }
      } catch (err) {
        console.error("Failed to download original in bulk, fallback", err);
        if (photo.file_url) {
          await new Promise(r => setTimeout(r, 150));
          const trigger = document.createElement('a');
          trigger.href = photo.file_url;
          trigger.download = photo.file_name;
          trigger.target = '_blank';
          document.body.appendChild(trigger);
          trigger.click();
          document.body.removeChild(trigger);
        }
      }
    }
    setSelectedPhotoIds([]);
  };

  const handleDownloadOriginal = async (photo: Photo) => {
    try {
      const originalPath = getOriginalStoragePath(photo);
      const signedUrl = await getSignedUrl(originalPath, 60);
      
      if (signedUrl) {
        const trigger = document.createElement('a');
        trigger.href = signedUrl;
        trigger.download = photo.file_name;
        trigger.target = '_blank';
        document.body.appendChild(trigger);
        trigger.click();
        document.body.removeChild(trigger);
      }
    } catch (err) {
      console.error("Failed to download original, falling back to preview", err);
      if (photo.file_url) {
        window.open(photo.file_url, '_blank');
      }
    }
  };

  const toggleFavorite = (photoId: string) => {
    let newFavorites = [...favoriteIds];
    if (favoriteIds.includes(photoId)) {
      newFavorites = favoriteIds.filter(fId => fId !== photoId);
    } else {
      newFavorites.push(photoId);
    }
    updateFavoritesList(newFavorites);
  };

  const handleMoveToTrash = (photoId: string) => {
    const newTrash = Array.from(new Set([...trashIds, photoId]));
    updateTrashList(newTrash);
    
    // Remove from favorites
    const newFavorites = favoriteIds.filter(fId => fId !== photoId);
    updateFavoritesList(newFavorites);

    setPhotos(prev => prev.filter(p => p.id !== photoId));
    fetchFolderCounts();
  };

  // Full Screen Lightbox Actions
  const openViewer = (index: number) => {
    setViewerIndex(index);
    setZoomLevel(1);
  };

  const closeViewer = () => {
    setViewerIndex(null);
  };

  const handleNextImage = () => {
    if (viewerIndex === null) return;
    setViewerIndex((viewerIndex + 1) % photos.length);
    setZoomLevel(1);
  };

  const handlePrevImage = () => {
    if (viewerIndex === null) return;
    setViewerIndex((viewerIndex - 1 + photos.length) % photos.length);
    setZoomLevel(1);
  };

  const handleViewerTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleViewerTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartXRef.current;
    
    if (Math.abs(diffX) > 60) {
      if (diffX > 0) {
        handlePrevImage();
      } else {
        handleNextImage();
      }
    }
    touchStartXRef.current = null;
  };

  const handleViewerDoubleTap = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setZoomLevel(prev => prev === 1 ? 2.2 : 1);
    }
    lastTapRef.current = now;
  };

  const handleShareCurrent = async (photo: Photo) => {
    if (!photo.file_url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.file_name,
          url: photo.file_url
        });
      } catch (err) {
        console.log("Shared dismissed", err);
      }
    } else {
      navigator.clipboard.writeText(photo.file_url);
      alert("Photo link copied to clipboard!");
    }
  };

  // Folder Operations
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !user) return;
    setIsCreatingFolder(true);

    try {
      const { error } = await supabase
        .from('folders')
        .insert([{ user_id: user.id, folder_name: newFolderName.trim() }]);

      if (error) throw error;

      setNewFolderName('');
      setShowNewFolderModal(false);
      await fetchFolders();
    } catch (err) {
      console.error("Folder creation failed", err);
      triggerAlert("Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleStartRename = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
    setShowFolderMenuId(null);
  };

  const handleSaveRename = async (folderId: string) => {
    if (!editingFolderName.trim()) return;

    try {
      const { error } = await supabase
        .from('folders')
        .update({ folder_name: editingFolderName.trim() })
        .eq('id', folderId);

      if (error) throw error;

      setEditingFolderId(null);
      await fetchFolders();
    } catch (err) {
      console.error("Rename failed", err);
      triggerAlert("Failed to rename folder");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Are you sure you want to delete this folder? photos inside will be kept in the general vault.")) return;

    try {
      await supabase
        .from('photos')
        .update({ folder_id: null })
        .eq('folder_id', folderId);

      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      if (selectedFolder === folderId) {
        navigate('/folders');
      }

      await fetchFolders();
      await fetchFolderCounts();
    } catch (err) {
      console.error("Delete folder failed", err);
      triggerAlert("Failed to delete folder");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden relative">
      
      {/* Floating alert notifications */}
      {alert && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/95 backdrop-blur text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
          {alert.type === 'success' ? (
            <CheckCircle2 className="text-green-400" size={16} />
          ) : (
            <AlertCircle className="text-red-400" size={16} />
          )}
          <span className="text-xs font-bold text-slate-100">{alert.text}</span>
        </div>
      )}
      
      {/* 1. TOP HEADER NAVIGATION - GOOGLE PHOTOS SELECTION OR SEARCH */}
      {selectedPhotoIds.length > 0 ? (
        <header className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 z-20 shadow-lg animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPhotoIds([])}
              className="p-2 -ml-2 hover:bg-white/10 active:scale-95 transition-all rounded-full"
            >
              <X size={20} className="stroke-[2.5]" />
            </button>
            <span className="text-sm font-extrabold tracking-tight">
              {selectedPhotoIds.length} Selected
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Bulk Favorite */}
            <button
              onClick={handleBulkFavorite}
              className="p-2.5 hover:bg-white/10 active:scale-95 transition-all rounded-full"
              title="Add to Starred"
            >
              <Heart size={18} className="text-purple-400" />
            </button>

            {/* Bulk Move Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                className="p-2.5 hover:bg-white/10 active:scale-95 transition-all rounded-full flex items-center gap-0.5"
                title="Move to Folder"
              >
                <FolderIcon size={18} className="text-purple-400" />
                <ChevronDown size={12} className="text-purple-300" />
              </button>
              
              {showMoveDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-slate-800 text-white rounded-2xl shadow-2xl p-2 border border-slate-700 z-50 max-h-52 overflow-y-auto">
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider px-2.5 py-1.5 text-left border-b border-slate-700">Move Selection To</p>
                  <button
                    onClick={() => handleBulkMoveToFolder(null)}
                    className="w-full text-left text-[11px] font-bold text-slate-200 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 transition-colors uppercase tracking-wide mt-1.5"
                  >
                    Unclassified PrivateVault
                  </button>
                  {folders.map(f => (
                    <button
                      key={f.id}
                      onClick={() => handleBulkMoveToFolder(f.id)}
                      className="w-full text-left text-[11px] font-bold text-slate-200 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 transition-colors uppercase tracking-wide truncate"
                    >
                      {f.folder_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk Download */}
            <button
              onClick={handleBulkDownload}
              className="p-2.5 hover:bg-white/10 active:scale-95 transition-all rounded-full"
              title="Download to Device"
            >
              <Download size={18} className="text-purple-400" />
            </button>

            {/* Bulk Trash / Delete */}
            {activeTab === 'trash' ? (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleBulkRestore}
                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-full active:scale-95 transition-all text-[10px] font-extrabold uppercase tracking-wider"
                >
                  Restore
                </button>
                <button
                  onClick={handleBulkPermanentDelete}
                  className="p-2.5 hover:bg-red-500/20 text-red-400 rounded-full active:scale-95 transition-all"
                  title="Delete Permanently"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleBulkMoveToTrash}
                className="p-2.5 hover:bg-red-500/10 text-red-400 rounded-full active:scale-95 transition-all"
                title="Move to Trash"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </header>
      ) : (
        <header className="px-4 pt-4 pb-3 flex flex-col gap-3 border-b border-slate-50 shrink-0 z-10">
          {/* Row 1: Search and Filter Bar */}
          <div className="flex items-center gap-2.5">
            {selectedFolder && (
              <button 
                onClick={() => navigate('/folders')}
                className="p-2 -ml-2 text-slate-600 active:scale-95 transition-all rounded-full"
              >
                <ArrowLeft size={18} className="stroke-[2.5]" />
              </button>
            )}

            <div className="flex-1 relative flex items-center bg-slate-100 rounded-full h-11 px-4 border border-transparent focus-within:bg-white focus-within:border-purple-200 transition-all">
              <Search size={16} className="text-slate-400 mr-2.5 shrink-0" />
              <input
                type="text"
                placeholder={selectedFolder ? "Search folder..." : "Search photos..."}
                className="w-full text-xs bg-transparent outline-none text-slate-800 font-semibold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Sort Options Button */}
            <button
              onClick={() => setShowSortOptions(!showSortOptions)}
              className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
                showSortOptions ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Row 2: Sort Picker Dropdown Pills (Snug & Minimal) */}
          {showSortOptions && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none animate-in slide-in-from-top-1 duration-150 shrink-0">
              {[
                { id: 'newest', label: 'Newest First' },
                { id: 'oldest', label: 'Oldest First' },
                { id: 'name_asc', label: 'Name A-Z' },
                { id: 'name_desc', label: 'Name Z-A' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSortBy(item.id);
                    setShowSortOptions(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-tight uppercase border transition-all shrink-0 select-none ${
                    sortBy === item.id 
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Row 3: Horizontal Scrollable Filter Chips (Google Photos Mobile UX) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none shrink-0 -mx-4 px-4">
            {[
              { id: 'all', label: 'All', active: activeTab === 'photos' && filterType === 'all' && !selectedFolder, onClick: () => { setFilterType('all'); navigate('/photos'); } },
              { id: 'recent', label: 'Recent', active: activeTab === 'photos' && filterType === 'recent' && !selectedFolder, onClick: () => { setFilterType('recent'); navigate('/photos'); } },
              { id: 'folders', label: 'Folders', active: activeTab === 'albums' || !!selectedFolder, onClick: () => navigate('/folders') },
              { id: 'favorites', label: 'Favorites', active: activeTab === 'favorites', onClick: () => navigate('/favorites') },
              { id: 'videos', label: 'Videos', active: activeTab === 'photos' && filterType === 'videos' && !selectedFolder, onClick: () => { setFilterType('videos'); navigate('/photos'); } },
            ].map(chip => (
              <button
                key={chip.id}
                onClick={chip.onClick}
                className={`px-4 py-2 rounded-full text-[11px] font-extrabold tracking-tight transition-all shrink-0 select-none flex items-center gap-1 border ${
                  chip.active 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200' 
                    : 'bg-slate-50 text-slate-600 border-slate-100 active:bg-slate-100'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Selected View Info Header */}
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                {selectedFolder 
                  ? folders.find(f => f.id === selectedFolder)?.folder_name || 'Folder Archive'
                  : activeTab === 'photos' 
                    ? (filterType === 'recent' ? 'Recent Uploads' : filterType === 'videos' ? 'Videos Only' : 'All Photos')
                    : activeTab === 'albums' 
                      ? 'Albums & Folders' 
                      : activeTab === 'favorites' 
                        ? 'Starred Favorites' 
                        : 'Trash PrivateVault'
                }
              </h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {selectedFolder ? `${photos.length} item(s) inside` : activeTab === 'albums' ? `${folders.length} directories` : `${photos.length} files total`}
              </p>
            </div>
          </div>
        </header>
      )}

      {/* 2. MAIN SCROLLABLE WRAPPER */}
      <div 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto px-4 pb-12 relative"
      >
        
        {/* Pull-To-Refresh Visual Indicator */}
        {pullDistance > 0 && (
          <div 
            className="flex items-center justify-center transition-all duration-75 overflow-hidden shrink-0 mb-3 mt-1.5"
            style={{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / 35, 1) }}
          >
            <div className="bg-slate-900/95 text-white shadow-xl px-3.5 py-1.5 rounded-full flex items-center justify-center gap-2 border border-white/10 backdrop-blur-sm">
              <Loader2 className={`text-purple-400 ${refreshing || pullDistance >= 55 ? 'animate-spin' : ''}`} size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-100">
                {refreshing ? 'Refreshing PrivateVault...' : pullDistance >= 55 ? 'Release to Sync' : 'Pull to Refresh'}
              </span>
            </div>
          </div>
        )}

        {/* Background active upload progression toast */}
        {uploadQueue.length > 0 && (() => {
          const completedCount = uploadQueue.filter(q => ['success', 'failed', 'duplicate', 'invalid_type', 'too_large'].includes(q.status)).length;
          const totalCount = uploadQueue.length;
          const isFinished = completedCount === totalCount;
          const successVal = uploadQueue.filter(q => q.status === 'success').length;
          const dupVal = uploadQueue.filter(q => q.status === 'duplicate').length;
          const invalidVal = uploadQueue.filter(q => q.status === 'invalid_type').length;
          const largeVal = uploadQueue.filter(q => q.status === 'too_large').length;
          const failVal = uploadQueue.filter(q => q.status === 'failed').length;

          const parts = [`${successVal} saved`];
          if (dupVal > 0) parts.push(`${dupVal} skipped (duplicate)`);
          if (invalidVal > 0) parts.push(`${invalidVal} invalid format`);
          if (largeVal > 0) parts.push(`${largeVal} too large (max 50MB)`);
          if (failVal > 0) parts.push(`${failVal} failed`);

          const toastMessage = isFinished 
            ? `Uploads finished: ${parts.join(', ')}`
            : `Processing uploads... (${completedCount}/${totalCount})`;

          return (
            <div className="mb-4 bg-slate-900 text-white rounded-2xl p-3 shadow-lg flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {isFinished ? (
                  <CheckCircle2 className="text-green-400" size={14} />
                ) : (
                  <Loader2 className="animate-spin text-purple-400" size={14} />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {toastMessage}
                </span>
              </div>
              {isFinished && failVal > 0 ? (
                <button
                  onClick={handleRetryFailedUploads}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all"
                >
                  Retry Failed
                </button>
              ) : !isFinished ? (
                <div className="w-16 bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                  ></div>
                </div>
              ) : null}
            </div>
          );
        })()}

        {/* FOLDERS TAB CONTENT */}
        {activeTab === 'albums' && !selectedFolder && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              {/* Creator Card */}
              <div 
                onClick={() => setShowNewFolderModal(true)}
                className="bg-purple-50/40 rounded-2xl overflow-hidden border border-dashed border-purple-200 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex flex-col items-center justify-center aspect-square text-center p-4 hover:bg-purple-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-2">
                  <FolderPlus size={18} />
                </div>
                <span className="text-xs font-black text-purple-900">Create Album</span>
                <span className="text-[9px] text-purple-400 mt-0.5 uppercase font-bold tracking-widest">New Folder</span>
              </div>

              {folders.map(folder => {
                const count = folderCounts[folder.id] || 0;
                const isEditing = editingFolderId === folder.id;

                return (
                  <div 
                    key={folder.id}
                    onClick={() => !isEditing && handleFolderClick(folder)}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
                  >
                    {/* Folder Art - Square cover similar to Google Photos Albums */}
                    <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                      {count > 0 && folderCovers[folder.id] ? (
                        <img 
                          src={folderCovers[folder.id]} 
                          alt={folder.folder_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-purple-600/10 to-purple-600/30 flex flex-col items-center justify-center text-purple-600">
                          <FolderIcon size={32} className="stroke-[2] text-purple-600" />
                        </div>
                      )}

                      {/* Folder Lock Overlay */}
                      {lockedFolderIds.includes(folder.id) && (
                        <div className="absolute top-2 right-2 bg-purple-600 text-white p-1.5 rounded-full shadow-md z-10 backdrop-blur-sm animate-pulse">
                          <Lock size={12} className="stroke-[2.5]" />
                        </div>
                      )}

                      {/* Dropdown menu trigger */}
                      <div className="absolute top-2 left-2 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFolderMenuId(showFolderMenuId === folder.id ? null : folder.id);
                          }}
                          className="p-1.5 bg-black/60 text-white rounded-full backdrop-blur-sm"
                        >
                          <MoreVertical size={12} />
                        </button>
                        
                        {showFolderMenuId === folder.id && (
                          <div className="absolute left-0 mt-1.5 w-36 bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-1 z-20">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(folder.id, folder.folder_name);
                              }}
                              className="w-full text-left text-[10px] font-extrabold uppercase tracking-wide text-slate-300 hover:text-white px-2.5 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1.5"
                            >
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFolderLock(folder.id);
                              }}
                              className="w-full text-left text-[10px] font-extrabold uppercase tracking-wide text-purple-400 hover:text-purple-300 px-2.5 py-2 rounded-lg hover:bg-purple-500/10 flex items-center gap-1.5"
                            >
                              {lockedFolderIds.includes(folder.id) ? (
                                <>
                                  <Unlock size={10} />
                                  <span>Unlock Album</span>
                                </>
                              ) : (
                                <>
                                  <Lock size={10} />
                                  <span>Lock Album</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id);
                              }}
                              className="w-full text-left text-[10px] font-extrabold uppercase tracking-wide text-red-400 hover:text-red-300 px-2.5 py-2 rounded-lg hover:bg-red-500/10 flex items-center gap-1.5"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Badge count */}
                      <span className="absolute bottom-2 right-2 bg-black/60 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-full backdrop-blur-sm uppercase tracking-wider">
                        {count} Photos
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="p-3 flex-1 flex flex-col justify-center bg-white border-t border-slate-50">
                      {isEditing ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1 font-bold outline-none text-slate-800"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            autoFocus
                          />
                          <button 
                            onClick={() => handleSaveRename(folder.id)} 
                            className="p-1 bg-purple-600 text-white rounded-md"
                          >
                            <Check size={12} />
                          </button>
                          <button 
                            onClick={() => setEditingFolderId(null)} 
                            className="p-1 bg-slate-200 text-slate-600 rounded-md"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-xs truncate leading-none flex items-center justify-between gap-1">
                            <span className="truncate">{folder.folder_name}</span>
                          </h4>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 block">
                            Created {new Date(folder.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {folders.length === 0 && (
                <div className="col-span-2 py-12 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <FolderIcon size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-800 font-extrabold text-xs">No Folders Created</p>
                  <p className="text-slate-400 text-[10px] mt-1">Create directories to classify shoots.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHOTOS GRID TAB CONTENT */}
        {(activeTab === 'photos' || activeTab === 'favorites' || activeTab === 'trash' || selectedFolder) && (
          <div className="space-y-4 pt-2">
            
            {/* If viewing inside an album cover banner */}
            {selectedFolder && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                    <FolderOpen size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      {folders.find(f => f.id === selectedFolder)?.folder_name || 'My Folder'}
                    </h3>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Directory details workspace</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleStartRename(selectedFolder, folders.find(f => f.id === selectedFolder)?.folder_name || '')}
                    className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl"
                    title="Rename"
                  >
                    <FolderIcon size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(selectedFolder)}
                    className="p-1.5 bg-red-50 text-red-500 rounded-xl"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Photos 3-column mobile / 4-column tablet / 5-column desktop grid with tight gap */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-0.5 sm:gap-1">
                {photos.map((photo, index) => {
                  const isFav = favoriteIds.includes(photo.id);
                  const isSelected = selectedPhotoIds.includes(photo.id);
                  const isVideo = photo.file_name.toLowerCase().match(/\.(mp4|mov|webm|avi|m4v|mkv)$/);

                  return (
                    <div
                      key={photo.id}
                      onTouchStart={() => startPressTimer(photo.id)}
                      onTouchEnd={cancelPressTimer}
                      onMouseDown={() => startPressTimer(photo.id)}
                      onMouseUp={cancelPressTimer}
                      onMouseLeave={cancelPressTimer}
                      onClick={() => handlePhotoTap(photo.id, index)}
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '110px' }}
                      className={`aspect-square bg-slate-100 overflow-hidden relative group cursor-pointer active:scale-95 transition-all rounded-sm ${
                        isSelected 
                          ? 'ring-4 ring-purple-600 ring-inset opacity-90' 
                          : 'hover:opacity-95'
                      }`}
                    >
                      {/* Image Source */}
                      {photo.file_url ? (
                        <img
                          src={photo.file_url}
                          alt={photo.file_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                          <ImageIcon size={20} />
                        </div>
                      )}

                      {/* Top Overlay Selection Indicators */}
                      {(isSelected || selectedPhotoIds.length > 0) && (
                        <div className="absolute top-1.5 right-1.5 z-10">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? 'bg-purple-600 text-white shadow-sm' : 'bg-black/30 text-white/50 border border-white/50'
                          }`}>
                            <Check size={10} className="stroke-[4]" />
                          </div>
                        </div>
                      )}

                      {/* Favorites visual pin badge */}
                      {isFav && !isSelected && (
                        <div className="absolute top-1.5 left-1.5 z-10 bg-black/40 p-1 rounded backdrop-blur-[1px]">
                          <Heart size={10} className="fill-red-500 text-red-500" />
                        </div>
                      )}

                      {/* Video Indicator */}
                      {isVideo && !isSelected && (
                        <div className="absolute bottom-1 right-1 bg-black/65 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest text-white flex items-center gap-0.5 backdrop-blur-[1px] uppercase">
                          <span className="w-1 h-1 bg-purple-500 rounded-full"></span>
                          <span>Vid</span>
                        </div>
                      )}

                      {/* Progressive skeleton overlay on fetch */}
                      {!photo.file_url && (
                        <div className="absolute inset-0 bg-slate-100/80 animate-pulse"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : loadingPhotos ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-0.5 sm:gap-1">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-slate-100 animate-pulse rounded-sm relative">
                    <div className="absolute inset-0 bg-slate-200/60"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center bg-slate-50 rounded-2xl border border-slate-100 px-4">
                {activeTab === 'favorites' ? (
                  <>
                    <Heart size={32} className="text-purple-300 mx-auto mb-2 fill-purple-100" />
                    <p className="text-slate-800 font-extrabold text-xs">No Favorites Starred</p>
                    <p className="text-slate-400 text-[10px] mt-1 font-semibold max-w-xs mx-auto">
                      Tap the heart icon on any photo to pin it to your favorites section for fast access.
                    </p>
                  </>
                ) : activeTab === 'trash' ? (
                  <>
                    <Trash2 size={32} className="text-purple-300 mx-auto mb-2" />
                    <p className="text-slate-800 font-extrabold text-xs">Trash PrivateVault is Empty</p>
                    <p className="text-slate-400 text-[10px] mt-1 font-semibold max-w-xs mx-auto">
                      No deleted items in your Trash PrivateVault. Deleted items are kept safe here until permanently cleared.
                    </p>
                  </>
                ) : selectedFolder ? (
                  <>
                    <FolderIcon size={32} className="text-purple-300 mx-auto mb-2" />
                    <p className="text-slate-800 font-extrabold text-xs">This Folder is Empty</p>
                    <p className="text-slate-400 text-[10px] mt-1 font-semibold max-w-xs mx-auto">
                      Move photos here from your Unclassified PrivateVault to keep this folder organized.
                    </p>
                  </>
                ) : (
                  <>
                    <ImageIcon size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-800 font-extrabold text-xs">No Photos Found</p>
                    <p className="text-slate-400 text-[10px] mt-1 font-semibold max-w-xs mx-auto">
                      Your secure cloud photo archive is empty. Begin uploading to safeguard your media files.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Load More Trigger Sentinel */}
            <div ref={observerTarget} className="h-10 w-full flex items-center justify-center">
              {loadingPhotos && (
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <Loader2 size={12} className="animate-spin text-purple-600" />
                  <span>Loading Archive...</span>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* 3. CONTEXTUAL BOTTOM ACTION BAR (Multi-Select Control Room) */}
      {selectedPhotoIds.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 bg-slate-900 text-white rounded-2xl shadow-2xl p-3 z-50 flex items-center justify-around gap-2 animate-in slide-in-from-bottom duration-200">
          
          {/* Favorite Toggle */}
          <button
            onClick={handleBulkFavorite}
            className="flex flex-col items-center gap-1 p-2 flex-1 active:scale-95 transition-all"
          >
            <Heart size={15} className="text-purple-400 fill-transparent" />
            <span className="text-[8px] font-extrabold uppercase tracking-wide">Star</span>
          </button>

          {/* Move to folder action sheet toggle */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowMoveDropdown(!showMoveDropdown)}
              className="w-full flex flex-col items-center gap-1 p-2 active:scale-95 transition-all"
            >
              <FolderIcon size={15} className="text-purple-400" />
              <span className="text-[8px] font-extrabold uppercase tracking-wide">Move</span>
            </button>

            {/* Quick dropdown layer inside mobile constraint */}
            {showMoveDropdown && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 bg-slate-800 rounded-xl shadow-2xl p-1.5 border border-slate-700 z-50 max-h-36 overflow-y-auto">
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider px-2 py-1 text-center">Move to</p>
                <button
                  onClick={() => handleBulkMoveToFolder(null)}
                  className="w-full text-left text-[9px] font-extrabold text-slate-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-700 uppercase"
                >
                  Unclassified PrivateVault
                </button>
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleBulkMoveToFolder(f.id)}
                    className="w-full text-left text-[9px] font-extrabold text-slate-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-700 uppercase truncate"
                  >
                    {f.folder_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Download */}
          <button
            onClick={handleBulkDownload}
            className="flex flex-col items-center gap-1 p-2 flex-1 active:scale-95 transition-all"
          >
            <Download size={15} className="text-purple-400" />
            <span className="text-[8px] font-extrabold uppercase tracking-wide">Save</span>
          </button>

          {/* Delete (Trash bin / Permanent depending on Trash state) */}
          {activeTab === 'trash' ? (
            <>
              <button
                onClick={handleBulkRestore}
                className="flex flex-col items-center gap-1 p-2 flex-1 active:scale-95 transition-all"
              >
                <Plus size={15} className="text-green-400" />
                <span className="text-[8px] font-extrabold uppercase tracking-wide text-green-400">Put Back</span>
              </button>
              <button
                onClick={handleBulkPermanentDelete}
                className="flex flex-col items-center gap-1 p-2 flex-1 active:scale-95 transition-all"
              >
                <Trash2 size={15} className="text-red-400" />
                <span className="text-[8px] font-extrabold uppercase tracking-wide text-red-400 font-bold">Delete</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleBulkMoveToTrash}
              className="flex flex-col items-center gap-1 p-2 flex-1 active:scale-95 transition-all"
            >
              <Trash2 size={15} className="text-red-400" />
              <span className="text-[8px] font-extrabold uppercase tracking-wide text-red-400">Trash</span>
            </button>
          )}

        </div>
      )}

      {/* 4. PRIMARY FLOATING ACTION BUTTON (➕ Upload Trigger) */}
      {selectedPhotoIds.length === 0 && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="fixed bottom-24 right-5 w-12 h-12 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg shadow-purple-200 z-30 transition-all cursor-pointer"
          title="Upload Photos & Videos"
        >
          <UploadCloud size={20} className="stroke-[2.5]" />
        </button>
      )}

      {/* Hidden File Input for Single Floating Upload Button */}
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/jpeg, image/png, image/webp, video/mp4, video/quicktime, video/webm, video/x-matroska, video/avi"
      />

      {/* 6. CREATE FOLDER POPUP MODAL */}
      {showNewFolderModal && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center px-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 text-center">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">New Private Album</h3>
            <p className="text-[10px] text-slate-400 font-semibold mb-4 leading-relaxed">
              Create a private folder to categorize and organize your personal photos.
            </p>
            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Folder Name (e.g. Vacation 2026)"
                className="w-full p-3 text-xs bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 text-slate-800 font-bold"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 disabled:opacity-50"
                >
                  {isCreatingFolder ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. IMMERSIVE GOOGLE PHOTOS STYLE VIEWER */}
      {viewerIndex !== null && photos[viewerIndex] && (
        <div 
          className="fixed inset-0 bg-black z-55 flex flex-col justify-between animate-in fade-in duration-200 text-white"
          onTouchStart={handleViewerTouchStart}
          onTouchEnd={handleViewerTouchEnd}
        >
          {/* Top Viewer Header Toolbar */}
          <div className="h-16 px-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10 shrink-0">
            <button 
              onClick={closeViewer}
              className="p-2 -ml-2 bg-black/40 rounded-full"
            >
              <ArrowLeft size={18} className="stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-1.5">
              {/* Zoom Buttons */}
              <button 
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.3, 3))}
                className="p-2 bg-black/40 rounded-full"
              >
                <ZoomIn size={15} />
              </button>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.3, 1))}
                className="p-2 bg-black/40 rounded-full"
              >
                <ZoomOut size={15} />
              </button>
              {/* Native device share */}
              <button 
                onClick={() => handleShareCurrent(photos[viewerIndex])}
                className="p-2 bg-black/40 rounded-full"
              >
                <Share2 size={15} />
              </button>
              {/* Direct Save/Download */}
              {photos[viewerIndex] && (
                <button 
                  onClick={() => handleDownloadOriginal(photos[viewerIndex])}
                  className="p-2 bg-black/40 rounded-full"
                >
                  <Download size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Center Immersive Image Stage */}
          <div 
            className="flex-1 flex items-center justify-center overflow-hidden relative"
            onTouchStart={handleViewerDoubleTap}
          >
            {/* Left and Right navigation desktop triggers */}
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white z-20 hidden md:block"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white z-20 hidden md:block"
            >
              <ChevronRight size={20} />
            </button>

            {/* Immersive centered image rendering */}
            <div 
              className="max-w-full max-h-full transition-transform duration-200 flex items-center justify-center select-none"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img 
                src={photos[viewerIndex].file_url} 
                alt={photos[viewerIndex].file_name}
                className="max-w-full max-h-full object-contain"
                draggable={false}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Bottom Viewer Details / Star pin overlay */}
          <div className="bg-gradient-to-t from-black/80 to-transparent p-4 flex flex-col gap-1 z-10 shrink-0 text-center">
            <p className="text-xs font-bold truncate tracking-tight">{photos[viewerIndex].file_name}</p>
            <div className="flex items-center justify-center gap-4 mt-2">
              <button 
                onClick={() => toggleFavorite(photos[viewerIndex].id)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/15 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <Heart size={12} className={favoriteIds.includes(photos[viewerIndex].id) ? 'fill-red-500 text-red-500' : 'text-white'} />
                <span>Starred</span>
              </button>
              <button 
                onClick={() => {
                  handleMoveToTrash(photos[viewerIndex].id);
                  closeViewer();
                }}
                className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/35 text-red-300 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. SECURE ALBUM LOCK PIN CHALLENGE OVERLAY */}
      {activePinChallengeFolderId && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-60 flex flex-col justify-center items-center px-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 bg-purple-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-purple-500/20 animate-bounce">
              <Lock size={28} className="stroke-[2.5]" />
            </div>

            <div>
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">PrivateVault</p>
              <h3 className="text-lg font-black text-white tracking-tight mt-1">
                Album Directory Secured
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-1 leading-relaxed max-w-[240px] mx-auto">
                Please enter your 4-digit security PIN code to access <span className="text-purple-300 font-bold">"{folders.find(f => f.id === activePinChallengeFolderId)?.folder_name || 'this album'}"</span>.
              </p>
            </div>

            {/* PIN Dots indicators */}
            <div className="flex justify-center items-center gap-4.5 py-4">
              {[1, 2, 3, 4].map((dot) => (
                <div 
                  key={dot}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    pinChallengeInput.length >= dot 
                      ? 'bg-purple-500 border-purple-500 scale-110 shadow-md shadow-purple-500/50' 
                      : 'border-slate-700 bg-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Error Message */}
            <div className="h-4">
              {pinChallengeError && (
                <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                  <AlertCircle size={12} />
                  {pinChallengeError}
                </p>
              )}
            </div>

            {/* Grid numeric keypad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleVerifyFolderPin(num.toString())}
                  className="h-14 bg-slate-800/60 hover:bg-slate-800 text-white font-extrabold text-lg rounded-2xl border border-slate-700/30 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleCancelPinChallenge}
                className="h-14 text-[10px] font-extrabold text-slate-400 hover:text-white uppercase tracking-wider flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleVerifyFolderPin('0')}
                className="h-14 bg-slate-800/60 hover:bg-slate-800 text-white font-extrabold text-lg rounded-2xl border border-slate-700/30 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinChallengeInput(prev => prev.slice(0, -1))}
                className="h-14 text-[10px] font-extrabold text-slate-400 hover:text-white uppercase tracking-wider flex items-center justify-center cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. NO SECURE PIN CONFIGURED ALERT MODAL */}
      {showNoPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60 flex items-center justify-center p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center border border-amber-100 shadow-sm">
              <KeyRound size={22} />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                PrivateVault Security PIN Required
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                You must set up a 4-digit security PIN in your profile settings before you can lock individual photo albums and directories.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowNoPinModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNoPinModal(false);
                  navigate('/profile');
                }}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[10px] rounded-xl uppercase tracking-wider shadow-md shadow-purple-200 transition-all active:scale-95"
              >
                Go to Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
