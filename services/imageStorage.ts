// High-Performance Image Upload & Google Drive CDN Service

// Transform Google Drive links to Google CDN Direct Image URLs
export function getDirectImageUrl(url?: string): string {
  if (!url) return '';

  // Base64 Data URLs and standard HTTPS image URLs pass through directly
  if (url.startsWith('data:image/') || url.startsWith('blob:')) {
    return url;
  }

  // Extract Google Drive File ID
  // Formats:
  // - https://drive.google.com/file/d/FILE_ID/view...
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/uc?id=FILE_ID...
  // - https://lh3.googleusercontent.com/d/FILE_ID...
  const driveFileRegex =
    /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(driveFileRegex);

  if (match && match[1]) {
    const fileId = match[1];
    // Google's global CDN direct image endpoint (must be paired with referrerPolicy="no-referrer")
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return url;
}

// Fallback handler for <img> tags: automatically switches to alternate Google Drive endpoints if 429 occurs
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>): void {
  const target = e.currentTarget;
  const currentSrc = target.src;

  // 0. If ephemeral blob URL expired after reload, hide gracefully
  if (currentSrc.startsWith('blob:')) {
    target.style.display = 'none';
    return;
  }

  // 1. If lh3 CDN was throttled (429) or failed, fall back to Google Drive thumbnail server
  if (currentSrc.includes('lh3.googleusercontent.com/d/')) {
    const match = currentSrc.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1] && !target.dataset.triedThumbnail) {
      target.dataset.triedThumbnail = 'true';
      target.src = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
      return;
    }
  }

  // 2. If thumbnail also failed, fall back to Google Drive direct view
  if (currentSrc.includes('drive.google.com/thumbnail') && !target.dataset.triedUc) {
    const match = currentSrc.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      target.dataset.triedUc = 'true';
      target.src = `https://drive.google.com/uc?export=view&id=${match[1]}`;
      return;
    }
  }
}

// Client-Side Canvas Compressor: preserves high visual fidelity (Full HD) while keeping payload optimal for Google Drive
export async function compressImage(
  file: File,
  maxDim = 1920,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      if (!raw) {
        reject(new Error('Failed to read image file'));
        return;
      }

      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Only downscale if the image exceeds max dimension
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(raw);
          return;
        }

        // Enable high-fidelity smoothing for crisp clarity
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with high quality setting
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

// Upload to user's Google Drive via Google Apps Script Web App with automatic 429 retry
export async function uploadToGoogleDrive(
  base64Data: string,
  filename: string,
  scriptUrl: string,
  retries = 2
): Promise<string> {
  if (!scriptUrl) {
    throw new Error('Google Drive upload script URL is not configured.');
  }

  // Extract pure base64 without "data:image/jpeg;base64," prefix
  const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // Backoff delay before retry (1.5s, 3s)
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }

      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Avoid CORS preflight with text/plain
        body: JSON.stringify({
          base64: pureBase64,
          filename: filename || `rmch_upload_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        }),
      });

      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        if (response.status === 429 || text.includes('429') || text.includes('rate limit')) {
          if (attempt < retries) continue;
          throw new Error('Google Drive rate limit exceeded (HTTP 429)');
        }
        throw new Error('Unexpected response from Google Drive WebApp');
      }

      if (data?.fileId) {
        return `https://lh3.googleusercontent.com/d/${data.fileId}`;
      }
      if (data?.url) {
        return getDirectImageUrl(data.url);
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      throw new Error('No fileId or URL returned from Google Drive script');
    } catch (err: any) {
      const isRateLimit =
        err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
      if (attempt < retries && isRateLimit) {
        continue;
      }
      if (attempt === retries) {
        throw err;
      }
    }
  }

  throw new Error('Google Drive upload failed after retries');
}

// Unified image uploader: compresses, uploads to Google Drive, falls back gracefully
export async function uploadImageFile(
  file: File,
  filenamePrefix = 'upload',
  maxDim = 1920,
  quality = 0.88
): Promise<{ url: string; isDrive: boolean }> {
  // 1. Client-side compression
  const compressed = await compressImage(file, maxDim, quality);

  // 2. Check for configured Google Drive WebApp script
  const scriptUrl = (import.meta as any).env?.VITE_GOOGLE_DRIVE_WEBAPP_URL;
  if (!scriptUrl) {
    console.warn('VITE_GOOGLE_DRIVE_WEBAPP_URL is not set. Using local compressed image.');
    return { url: compressed, isDrive: false };
  }

  try {
    const filename = `${filenamePrefix}_${Date.now()}.jpg`;
    const driveUrl = await uploadToGoogleDrive(compressed, filename, scriptUrl);
    return { url: driveUrl, isDrive: true };
  } catch (err) {
    console.warn('Google Drive WebApp upload skipped or failed, fallback to compressed image:', err);
    return { url: compressed, isDrive: false };
  }
}
