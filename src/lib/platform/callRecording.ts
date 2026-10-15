/** Helpers for recording sales calls on the platform console. Pure so they can be unit-tested. */

/** Formats best for Google Speech-to-Text first (WebM/Ogg Opus); anything else still saves, just without a transcript. */
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

/** Speech-to-Text can only read WebM/Ogg Opus here. */
export function canTranscribe(mime: string): boolean {
  const m = mime.toLowerCase();
  return m.includes('webm') || m.includes('ogg');
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Spoken-language choices; "auto" lets the speech service detect Sinhala / Tamil / English. */
export const CALL_LANGUAGES: { code: string; label: string }[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en-US', label: 'English' },
  { code: 'si-LK', label: 'Sinhala (සිංහල)' },
  { code: 'ta-LK', label: 'Tamil (தமிழ்)' },
  { code: 'hi-IN', label: 'Hindi' },
];

export interface CallRecordingInfo {
  /** Storage path of the saved audio. */
  path: string;
  /** Playable download URL. */
  url: string;
  mime: string;
  durationSec: number;
  sizeBytes: number;
}

/** What transcription + summary produced for one recording. */
export interface CallAnalysis {
  transcript: string;
  languageCode: string;
  languageName: string;
  summary: string;
  requirements: string[];
  followUps: string[];
}

/** The text that goes into the call note: summary, then what they need and agreed next steps. */
export function analysisToNote(a: Pick<CallAnalysis, 'summary' | 'requirements' | 'followUps'>): string {
  const parts: string[] = [];
  if (a.summary.trim()) parts.push(a.summary.trim());
  if (a.requirements.length) parts.push(['Needs:', ...a.requirements.map((r) => `• ${r}`)].join('\n'));
  if (a.followUps.length) parts.push(['Next steps:', ...a.followUps.map((r) => `• ${r}`)].join('\n'));
  return parts.join('\n\n');
}
