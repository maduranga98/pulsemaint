import type { PublicSubmissionAttachment } from '@/services/contractorSafetyTraining.service';

/** A file the contractor picked or recorded, ready to send. */
export interface PendingAttachment extends PublicSubmissionAttachment {
  id: string;
  kind: 'image' | 'audio';
  sizeBytes: number;
  /** Object URL for the preview — revoke when removed. */
  previewUrl: string;
}

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.78;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not open the image.'));
    };
    img.src = url;
  });
}

/** Base64 length → decoded bytes. */
export function base64Bytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Downscales a photo to a JPEG so a phone camera shot (often 4–8 MB) fits the
 * submission limit. Falls back to the original file when the browser can't
 * decode it (e.g. HEIC outside Safari) and it is small enough to send as-is.
 */
export async function prepareImage(file: File, id: string): Promise<PendingAttachment> {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('Could not compress the image.');
    const data = await blobToBase64(blob);
    return {
      id,
      kind: 'image',
      name: file.name || 'photo.jpg',
      mimeType: 'image/jpeg',
      data,
      sizeBytes: base64Bytes(data),
      previewUrl: URL.createObjectURL(blob),
    };
  } catch (err) {
    if (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && file.size <= 2 * 1024 * 1024) {
      const data = await blobToBase64(file);
      return {
        id,
        kind: 'image',
        name: file.name || 'photo',
        mimeType: file.type,
        data,
        sizeBytes: base64Bytes(data),
        previewUrl: URL.createObjectURL(file),
      };
    }
    throw err;
  }
}

/** The best voice-recording format this browser can produce, or null when it can't record. */
export function pickRecordingType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? '';
}

export async function prepareRecording(blob: Blob, id: string): Promise<PendingAttachment> {
  const mimeType = (blob.type || 'audio/webm').split(';')[0];
  const data = await blobToBase64(blob);
  const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  return {
    id,
    kind: 'audio',
    name: `voice-note.${ext}`,
    mimeType,
    data,
    sizeBytes: base64Bytes(data),
    previewUrl: URL.createObjectURL(blob),
  };
}
