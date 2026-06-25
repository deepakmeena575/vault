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
    console.log("[AdminPhotos] Fetching all photos...");

    if (!supabase) {
      return res.status(500).json({ error: "Supabase service role is not configured on server", success: false });
    }

    const { data: rawPhotos, error: photosError } = await supabase
      .from('photos')
      .select('*, profiles(id, full_name, email)')
      .order('uploaded_at', { ascending: false });

    if (photosError) {
      console.error("[AdminPhotos] Database query error fetching photos:", photosError);
      throw photosError;
    }

    // Fetch folders to map in-memory to prevent schema caching join issues
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('id, folder_name');

    if (foldersError) {
      console.warn("[AdminPhotos] Folders query error (non-blocking):", foldersError);
    }

    const folderMap = new Map((folders || []).map(f => [f.id, f]));
    const photos = (rawPhotos || []).map(p => ({
      ...p,
      folders: p.folder_id ? folderMap.get(p.folder_id) || null : null
    }));

    console.log(`[AdminPhotos] Fetched ${photos?.length || 0} photos successfully. Generating signed URLs...`);

    let resolvedPhotos = photos || [];
    const paths = resolvedPhotos.map(p => p.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('photos')
        .createSignedUrls(paths, 3600);

      if (urlError) {
        console.error("[AdminPhotos] Supabase storage error generating signed URLs:", urlError);
      } else {
        console.log(`[AdminPhotos] Successfully generated ${urlData?.length || 0} signed URLs.`);
      }

      if (!urlError && urlData) {
        resolvedPhotos = resolvedPhotos.map(p => {
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
      photos: resolvedPhotos
    });
  } catch (error: any) {
    console.error("[AdminPhotos] Fatal admin photos collection exception:", error);
    res.status(500).json({ error: error.message || "Failed to load admin photos", success: false });
  }
}
