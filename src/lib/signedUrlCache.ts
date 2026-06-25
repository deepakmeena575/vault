import { supabase } from './supabase';

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CachedUrl>();

// 3600 seconds = 1 hour. We'll refresh if it has less than 10 minutes (600,000 ms) left.
const EXPIRY_THRESHOLD = 10 * 60 * 1000;
const SIGNED_URL_TTL = 3600; // 1 hour in seconds

/**
 * Gets a fresh or cached signed URL for a single storage path.
 * Retries up to 3 times on failure.
 */
export async function getSignedUrl(storagePath: string, ttl: number = SIGNED_URL_TTL): Promise<string> {
  if (!storagePath) return '';
  const now = Date.now();
  const cached = cache.get(storagePath);
  if (cached && (cached.expiresAt - now > EXPIRY_THRESHOLD)) {
    return cached.url;
  }

  let attempts = 3;
  while (attempts > 0) {
    try {
      const { data, error } = await supabase.storage
        .from('photos')
        .createSignedUrl(storagePath, ttl);

      if (error) throw error;
      if (data?.signedUrl) {
        cache.set(storagePath, {
          url: data.signedUrl,
          expiresAt: Date.now() + ttl * 1000
        });
        return data.signedUrl;
      }
      throw new Error('No signed URL returned');
    } catch (err) {
      attempts--;
      if (attempts === 0) {
        console.error(`Failed to generate signed URL for ${storagePath} after 3 attempts`, err);
        if (cached) return cached.url;
        return '';
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return '';
}

/**
 * Batches signed URL requests using createSignedUrls.
 * Handles existing valid cached paths by skipping them.
 * Automatically retries failures.
 */
export async function getSignedUrlsBatch(storagePaths: string[], ttl: number = SIGNED_URL_TTL): Promise<Record<string, string>> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const pathsToSign: string[] = [];

  storagePaths.forEach(path => {
    if (!path) return;
    const cached = cache.get(path);
    if (cached && (cached.expiresAt - now > EXPIRY_THRESHOLD)) {
      result[path] = cached.url;
    } else {
      pathsToSign.push(path);
    }
  });

  if (pathsToSign.length === 0) {
    // Everything is already cached
    storagePaths.forEach(path => {
      if (path) {
        result[path] = cache.get(path)?.url || '';
      }
    });
    return result;
  }

  let attempts = 3;
  while (attempts > 0) {
    try {
      const { data, error } = await supabase.storage
        .from('photos')
        .createSignedUrls(pathsToSign, ttl);

      if (error) throw error;
      if (data) {
        data.forEach(item => {
          if (item.signedUrl) {
            const matchedPath = pathsToSign.find(p => p.endsWith(item.path) || item.path.endsWith(p)) || item.path;
            cache.set(matchedPath, {
              url: item.signedUrl,
              expiresAt: Date.now() + ttl * 1000
            });
            result[matchedPath] = item.signedUrl;
          }
        });
      }
      break;
    } catch (err) {
      attempts--;
      if (attempts === 0) {
        console.error(`Failed to batch generate signed URLs after 3 attempts`, err);
        // Fallback to cache where available
        pathsToSign.forEach(path => {
          const cached = cache.get(path);
          if (cached) result[path] = cached.url;
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Populate any remaining unsigned with empty string or cached url
  storagePaths.forEach(path => {
    if (!result[path]) {
      result[path] = cache.get(path)?.url || '';
    }
  });

  return result;
}

/**
 * Helper to map an array of photo objects with signed URLs from the cache or batch API.
 */
export async function populatePhotosWithSignedUrls<T extends { storage_path: string }>(photos: T[]): Promise<(T & { file_url: string })[]> {
  const paths = photos.map(p => p.storage_path).filter(Boolean);
  const urlMap = await getSignedUrlsBatch(paths);
  return photos.map(p => ({
    ...p,
    file_url: urlMap[p.storage_path] || ''
  }));
}
