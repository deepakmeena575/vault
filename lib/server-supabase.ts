import { createClient } from '@supabase/supabase-js';

console.log('SUPABASE_URL_PRESENT', !!process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY_PRESENT', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Programmatically ensure the 'photos' storage bucket exists
async function ensurePhotosBucket() {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Storage Setup] Supabase config incomplete. Skipping bucket initialization.');
      return;
    }
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('[Storage Setup] Error listing buckets:', error);
      return;
    }
    const hasPhotos = buckets.some(b => b.name === 'photos');
    if (!hasPhotos) {
      console.log('[Storage Setup] Creating "photos" bucket...');
      const { data, error: createError } = await supabase.storage.createBucket('photos', {
        public: false, // keep it private, use signed URLs
      });
      if (createError) {
        console.error('[Storage Setup] Error creating "photos" bucket:', createError);
      } else {
        console.log('[Storage Setup] Successfully created "photos" bucket:', data);
      }
    } else {
      console.log('[Storage Setup] "photos" bucket already exists.');
    }
  } catch (err) {
    console.error('[Storage Setup] Failed to ensure photos bucket:', err);
  }
}

ensurePhotosBucket();
