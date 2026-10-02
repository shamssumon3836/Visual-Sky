import { EmailAttachment } from '../types';

const blobUrlCache = new Map<string, string>();
const inFlightWarmups = new Map<string, Promise<string | null>>();

export type EnrichedAttachment = EmailAttachment & {
  _msgId?: string;
  _idx?: number;
};

export function getAttachmentCacheKey(att?: EnrichedAttachment | null): string {
  if (!att) return '';
  const idPart = String(att.id || '').trim();
  const namePart = String(att.name || '').trim().toLowerCase();
  const msgPart = String(att._msgId || '').trim();
  const idxPart = typeof att._idx === 'number' ? String(att._idx) : '';
  return `${idPart}::${namePart}::${msgPart}::${idxPart}`;
}

export function isImageAttachmentFast(att?: EmailAttachment | null): boolean {
  if (!att) return false;
  const mime = String(att.mimeType || '').toLowerCase();
  const name = String(att.name || '').toLowerCase();
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

export function buildAttachmentViewUrl(att?: EnrichedAttachment | null): string {
  if (!att) return '';
  if (att.viewUrl && /^https?:\/\//i.test(att.viewUrl)) return att.viewUrl;
  const params = new URLSearchParams();
  if (att.name) params.set('name', att.name);
  if (att._msgId) params.set('msgId', att._msgId);
  if (typeof att._idx === 'number') params.set('idx', String(att._idx));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const targetId = att.id || 'attachment';
  return `/api/attachments/view/${encodeURIComponent(targetId)}${qs}`;
}

export function buildAttachmentDownloadUrl(att?: EnrichedAttachment | null): string {
  if (!att) return '';
  if (att.downloadUrl && /^https?:\/\//i.test(att.downloadUrl)) return att.downloadUrl;
  const params = new URLSearchParams();
  if (att.name) params.set('name', att.name);
  if (att._msgId) params.set('msgId', att._msgId);
  if (typeof att._idx === 'number') params.set('idx', String(att._idx));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const targetId = att.id || 'attachment';
  return `/api/attachments/download/${encodeURIComponent(targetId)}${qs}`;
}

function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/^data:([^;]+)/i);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function getCachedBlobUrl(att?: EnrichedAttachment | null): string | null {
  if (!att) return null;
  const key = getAttachmentCacheKey(att);
  if (!key) return null;
  const existing = blobUrlCache.get(key);
  if (existing) return existing;

  if (att.id && blobUrlCache.has(att.id)) {
    return blobUrlCache.get(att.id) || null;
  }

  if (att.contentBase64 && att.contentBase64.startsWith('data:')) {
    const converted = dataUrlToBlobUrl(att.contentBase64);
    if (converted) {
      blobUrlCache.set(key, converted);
      if (att.id) blobUrlCache.set(att.id, converted);
      return converted;
    }
  }
  return null;
}

export function warmAttachmentInBackground(
  att?: EnrichedAttachment | null,
  onReady?: (blobUrl: string) => void
): Promise<string | null> {
  if (!att) return Promise.resolve(null);
  const cached = getCachedBlobUrl(att);
  if (cached) {
    if (onReady) onReady(cached);
    return Promise.resolve(cached);
  }

  const key = getAttachmentCacheKey(att);
  if (!key) return Promise.resolve(null);

  const existingPromise = inFlightWarmups.get(key);
  if (existingPromise) {
    if (onReady) {
      existingPromise.then(url => {
        if (url) onReady(url);
      });
    }
    return existingPromise;
  }

  const viewUrl = buildAttachmentViewUrl(att);
  if (!viewUrl) return Promise.resolve(null);

  const warmupPromise = (async () => {
    try {
      const res = await fetch(viewUrl, { credentials: 'same-origin' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return null;
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(key, blobUrl);
      if (att.id) blobUrlCache.set(att.id, blobUrl);

      // Pre-decode bitmap in background so <img> inside View Modal paints in 0ms
      if (isImageAttachmentFast(att)) {
        try {
          const img = new Image();
          img.src = blobUrl;
          if (typeof img.decode === 'function') {
            img.decode().catch(() => {});
          }
        } catch {}
      }

      if (onReady) onReady(blobUrl);
      return blobUrl;
    } catch {
      return null;
    } finally {
      inFlightWarmups.delete(key);
    }
  })();

  inFlightWarmups.set(key, warmupPromise);
  return warmupPromise;
}

export function getFastAttachmentViewSrc(att?: EnrichedAttachment | null): string {
  if (!att) return '';
  const cached = getCachedBlobUrl(att);
  if (cached) return cached;
  if (att.contentBase64 && att.contentBase64.startsWith('data:')) return att.contentBase64;
  return buildAttachmentViewUrl(att);
}

export function triggerInstantAttachmentDownload(att?: EnrichedAttachment | null): boolean {
  if (!att) return false;
  const fileName = att.name || 'attachment';

  // 1. If already in RAM blob cache (or inline base64), trigger 0ms local blob download immediately
  const cachedBlobUrl = getCachedBlobUrl(att);
  if (cachedBlobUrl) {
    const link = document.createElement('a');
    link.href = cachedBlobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  // 2. Otherwise trigger browser's native C++ download stream immediately (<20ms response, no JS buffering delay)
  const downloadUrl = buildAttachmentDownloadUrl(att);
  if (downloadUrl) {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Also warm into RAM cache for subsequent clicks/views
    warmAttachmentInBackground(att);
    return true;
  }

  // 3. Fallback to Google Drive direct file URL if available
  if (att.driveFileUrl && !att.driveFileUrl.includes('/folders/')) {
    const link = document.createElement('a');
    link.href = att.driveFileUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  return false;
}
