import { supabase } from './supabase';

export interface OptimizationResult {
  preview: File; // WebP, max 1920px, quality 80-85%
  original: File; // Compressed (saver/balanced) or untouched raw (original quality)
  originalSize: number;
  previewSize: number;
  savingsPercent: number;
  savingsBytes: number;
}

/**
 * Validates a file for size (max 50MB) and type (image/video).
 */
export const validateFile = (file: File): { isValid: boolean; reason?: 'invalid_type' | 'too_large' } => {
  const maxSizeBytes = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSizeBytes) {
    return { isValid: false, reason: 'too_large' };
  }

  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  
  const isMediaMime = mimeType.startsWith('image/') || mimeType.startsWith('video/');
  
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.svg',
    '.mp4', '.mov', '.qt', '.webm', '.mkv', '.avi', '.mpeg', '.mpg', '.m4v'
  ];
  const hasMediaExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

  if (!isMediaMime && !hasMediaExtension) {
    return { isValid: false, reason: 'invalid_type' };
  }

  return { isValid: true };
};

/**
 * Optimizes an image file based on the selected quality mode.
 * Converts to WebP format, resizes conditionally, and calculates space savings.
 */
export const optimizeImage = async (
  file: File,
  mode: 'saver' | 'balanced' | 'original'
): Promise<OptimizationResult> => {
  const originalSize = file.size;

  // Handle non-image assets or gifs/svgs that shouldn't be flattened
  if (!file.type.startsWith('image/') || file.type.includes('gif') || file.type.includes('svg')) {
    return {
      preview: file,
      original: file,
      originalSize,
      previewSize: originalSize,
      savingsPercent: 0,
      savingsBytes: 0,
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Helper to compress to WebP canvas
        const canvasCompress = (
          maxDimension: number,
          quality: number
        ): Promise<File> => {
          return new Promise((resBlob) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resBlob(file);
              return;
            }

            let width = img.width;
            let height = img.height;

            // Resize only if larger than maxDimension
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                maxDimension = height; // Wait, actually height becomes maxDimension:
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  // Keep name but replace extension with .webp
                  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                  const compressedFile = new File([blob], `${baseName}.webp`, {
                    type: 'image/webp',
                    lastModified: Date.now(),
                  });
                  resBlob(compressedFile);
                } else {
                  resBlob(file);
                }
              },
              'image/webp',
              quality
            );
          });
        };

        // Create standard high-performance preview (always WebP, max 1920px, quality 82%)
        const previewPromise = canvasCompress(1920, 0.82);

        // Create original file based on chosen mode
        let originalPromise: Promise<File>;
        if (mode === 'saver') {
          // Saver compresses original to WebP (max 1920px, 82% quality)
          originalPromise = previewPromise;
        } else if (mode === 'balanced') {
          // Balanced compresses original to higher-res WebP (max 2560px, 90% quality)
          originalPromise = canvasCompress(2560, 0.90);
        } else {
          // Original quality preserves exact raw file
          originalPromise = Promise.resolve(file);
        }

        Promise.all([previewPromise, originalPromise]).then(([previewFile, originalFile]) => {
          // Calculate storage savings
          const finalUploadedSize = mode === 'saver' ? previewFile.size : originalFile.size;
          const savingsBytes = Math.max(0, originalSize - finalUploadedSize);
          const savingsPercent = originalSize > 0 
            ? Math.min(99, Math.round((savingsBytes / originalSize) * 100)) 
            : 0;

          resolve({
            preview: previewFile,
            original: originalFile,
            originalSize,
            previewSize: previewFile.size,
            savingsPercent,
            savingsBytes,
          });
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Checks if a file is already uploaded to Supabase to prevent duplicate vault storage.
 */
export const checkDuplicateUpload = async (
  userId: string,
  fileName: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('id')
      .eq('user_id', userId)
      .eq('file_name', fileName)
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  } catch (err) {
    console.error('Failed to query duplicate status', err);
    return false;
  }
};

/**
 * Resolves the original storage path from the fast preview storage path.
 * If the path contains the preview prefix, it replaces it with original
 * and keeps the correct extension from the original file name.
 */
export const getOriginalStoragePath = (photo: { storage_path: string; file_name: string }): string => {
  const path = photo.storage_path;
  if (path.includes('/preview_')) {
    const ext = photo.file_name.split('.').pop() || 'jpg';
    return path.replace('/preview_', '/original_').replace('.webp', `_${ext}`);
  }
  return path;
};
