/**
 * Persistence for QR-scan deep links across the login flow.
 *
 * Router `location.state` does not survive full page reloads (phone
 * reCAPTCHA, redirect-based sign-in, manual refresh), so the scanned
 * machine and the post-login redirect are also kept in sessionStorage.
 * Entries expire so a stale scan never hijacks a later login.
 */

const REDIRECT_KEY = 'pm.postLoginRedirect';
const SCAN_MACHINE_KEY = 'pm.pendingScanMachineId';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface StoredValue {
  v: string;
  ts: number;
}

function save(key: string, value: string): void {
  try {
    const payload: StoredValue = { v: value, ts: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage unavailable (private mode quota etc.) — router state still works.
  }
}

function read(key: string, consume: boolean): string | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    if (consume) sessionStorage.removeItem(key);
    const parsed = JSON.parse(raw) as StoredValue;
    if (!parsed?.v || Date.now() - parsed.ts > TTL_MS) return null;
    return parsed.v;
  } catch {
    return null;
  }
}

export function savePostLoginRedirect(path: string): void {
  save(REDIRECT_KEY, path);
}

/** Peek without clearing — login may re-render several times before navigating. */
export function peekPostLoginRedirect(): string | null {
  return read(REDIRECT_KEY, false);
}

export function consumePostLoginRedirect(): string | null {
  return read(REDIRECT_KEY, true);
}

export function savePendingScanMachineId(machineId: string): void {
  save(SCAN_MACHINE_KEY, machineId);
}

export function consumePendingScanMachineId(): string | null {
  return read(SCAN_MACHINE_KEY, true);
}
