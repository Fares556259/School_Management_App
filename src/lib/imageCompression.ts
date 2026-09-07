/**
 * Client-Side Image Compression & Optimization Utility
 * 
 * Automatically scales down high-resolution smartphone/camera photos
 * (e.g. 5-10 MB, 4000x3000px) to lightweight, optimized WebP/JPEG files
 * (80-150 KB) directly in the user's browser before upload.
 * 
 * Preserves PDFs and non-image files intact without modification.
 */

export interface ImageCompressionOptions {
  /** Maximum width in pixels. Default: 1200 */
  maxWidth?: number;
  /** Maximum height in pixels. Default: 1200 */
  maxHeight?: number;
  /** Compression quality between 0.1 and 1.0. Default: 0.80 */
  quality?: number;
  /** Output MIME type. Default: 'image/webp' with automatic JPEG fallback */
  mimeType?: 'image/webp' | 'image/jpeg';
}

/**
 * Loads an image file using createImageBitmap (preferred for EXIF orientation)
 * or falls back to an HTMLImageElement.
 */
async function loadImage(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) => void;
  cleanup: () => void;
}> {
  if (typeof window !== 'undefined' && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => {
          try {
            bitmap.close();
          } catch {
            // ignore
          }
        },
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => {
          URL.revokeObjectURL(url);
        },
      });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Compresses an image file on the client side.
 * If the file is not an image (e.g. PDF), or if compression produces a larger file,
 * or if compression fails, the original file is returned safely.
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  // Pass non-image or vector/animated formats through untouched
  if (
    !file ||
    !file.type ||
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif'
  ) {
    return file;
  }

  // Safety check: ensure running in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    mimeType = 'image/webp',
  } = options;

  let loaded: {
    width: number;
    height: number;
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
    cleanup: () => void;
  } | null = null;

  try {
    loaded = await loadImage(file);
    let { width, height } = loaded;

    // Do not upscale if already smaller than max dimensions
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      loaded.cleanup();
      return file;
    }

    // Fill transparent backgrounds with white if converting to JPEG
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    loaded.draw(ctx, width, height);
    loaded.cleanup();
    loaded = null;

    // Export compressed blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else if (mimeType !== 'image/jpeg') {
            // Fallback to JPEG if WebP export is not supported by canvas
            canvas.toBlob((jpegResult) => resolve(jpegResult), 'image/jpeg', quality);
          } else {
            resolve(null);
          }
        },
        mimeType,
        quality
      );
    });

    if (!blob) {
      return file;
    }

    // If the compressed output is not smaller, keep original file
    if (blob.size >= file.size) {
      return file;
    }

    // Determine target extension
    const outputType = blob.type || mimeType;
    const ext = outputType.includes('webp') ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    const newFileName = `${baseName}.${ext}`;

    return new File([blob], newFileName, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('[imageCompression] Compression skipped, using original file:', err);
    if (loaded) {
      try {
        loaded.cleanup();
      } catch {
        // ignore
      }
    }
    return file;
  }
}

/**
 * Compresses an array of files in parallel.
 * Non-image files (e.g. PDFs) remain unchanged.
 */
export async function compressImageFiles(
  files: File[],
  options?: ImageCompressionOptions
): Promise<File[]> {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map((file) => compressImage(file, options)));
}
