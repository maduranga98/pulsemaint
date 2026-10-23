/**
 * Links that come from stored data (a notification's `linkTo`, an attachment
 * URL) are written by other users, so they are never trusted as-is: a
 * `javascript:` URL in an <a href> or window.location.assign() would run
 * script as whoever clicks it.
 */

/** An in-app path ("/app/work-orders?woId=1"), or null — never a full URL, `//host`, or `javascript:`. */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length === 0 || v.length > 500) return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  return v;
}

/** An http(s) URL (or null) — for links to files and external pages. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > 4000) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
