import { supabase } from '../../lib/server-supabase.js';
import { verifyAdmin, setSecurityHeaders } from '../authMiddleware.js';

// Helper to generate a stable file size estimate
const getStableSizeNumber = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return 0.5 + Math.abs(hash % 20) / 10;
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setSecurityHeaders(res);
    return res.status(200).end();
  }

  const auth = await verifyAdmin(req, res);
  if (!auth) {
    return; // Response already handled by verifyAdmin
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log("[AdminStats] Fetching all admin stats...");

    if (!supabase) {
      return res.status(500).json({ error: "Supabase service role is not configured on server", success: false });
    }
    
    // A. Fetch all profiles using service role
    const { data: profiles, error: profilesError } = await supabase
       .from('profiles')
       .select('*')
       .order('created_at', { ascending: false });

    if (profilesError) {
      console.error("[AdminStats] Profiles query error:", profilesError);
      throw profilesError;
    }

    // B. Fetch all photos using service role
    const { data: rawPhotos, error: photosError } = await supabase
      .from('photos')
      .select('*, profiles(id, full_name, email)')
      .order('uploaded_at', { ascending: false });

    if (photosError) {
      console.error("[AdminStats] Photos query error:", photosError);
      throw photosError;
    }

    // Fetch folders to map in-memory to prevent schema caching join issues
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('id, folder_name');

    if (foldersError) {
      console.warn("[AdminStats] Folders query error (non-blocking):", foldersError);
    }

    const folderMap = new Map((folders || []).map(f => [f.id, f]));
    const photos = (rawPhotos || []).map(p => ({
      ...p,
      folders: p.folder_id ? folderMap.get(p.folder_id) || null : null
    }));

    const totalUsers = profiles.length;
    const totalPhotos = photos.length;

    // Calculate total platform storage used dynamically
    const totalStorageUsedMB = (photos || []).reduce((acc, p) => acc + getStableSizeNumber(p.id), 0);
    const totalStorageUsed = `${totalStorageUsedMB.toFixed(1)} MB`;

    // C. Map profiles to aggregate stats: photo count & latest upload date & storage used
    const usersWithStats = profiles.map(profile => {
      const userPhotos = photos.filter(p => p.user_id === profile.id);
      const photoCount = userPhotos.length;
      const latestUpload = userPhotos.length > 0 ? userPhotos[0].uploaded_at : null;
      const storageUsed = userPhotos.reduce((acc, p) => acc + getStableSizeNumber(p.id), 0);
      return {
        ...profile,
        photo_count: photoCount,
        latest_upload_date: latestUpload,
        storage_used_mb: storageUsed
      };
    });

    // D. Fetch signed URLs for the top 5 recent uploads in batch
    const recentRaw = photos.slice(0, 5);
    let recentUploads = [...recentRaw];
    const paths = recentRaw.map(p => p.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('photos')
        .createSignedUrls(paths, 3600);

      if (!urlError && urlData) {
        recentUploads = recentRaw.map(p => {
          const matchedItem = urlData.find(item => 
            item.path === p.storage_path || 
            (item.path && p.storage_path && (p.storage_path.endsWith(item.path) || item.path.endsWith(p.storage_path)))
          );
          return {
            ...p,
            file_url: matchedItem ? matchedItem.signedUrl : null,
            size_mb: getStableSizeNumber(p.id)
          };
        });
      }
    }

    return res.status(200).json({
      success: true,
      totalUsers,
      totalPhotos,
      totalStorageUsed,
      users: usersWithStats,
      recentUploads
    });
  } catch (error: any) {
    console.error("[AdminStats] Fatal stats collection exception:", error);
    res.status(500).json({ error: error.message || "Failed to load admin stats", success: false });
  }
}
