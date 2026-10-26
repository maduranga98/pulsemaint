/** Helpers for recording sales calls on the platform console. Pure so they can be unit-tested. */

/** Preferred recording formats, best supported first. */
const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export function pickRecordingMime(isSupported: (mime: string) => boolean): string | null {
  return MIME_PREFERENCE.find((m) => isSupported(m)) ?? null;
}

export function extensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('aac')) return 'm4a';
  return 'bin';
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface CallRecordingInfo {
  /** Storage path of the saved audio. */
  path: string;
  /** Playable download URL. */
  url: string;
  mime: string;
  durationSec: number;
  sizeBytes: number;
}
