/**
 * Device-level notification support: the browser/OS "Notification" API plus
 * a short audio chime, layered on top of the existing in-app notification
 * bell. Every role/module already funnels through `createNotification()`
 * (src/services/notifications.service.ts) into the `notifications`
 * collection — this module is deliberately generic so wiring it into
 * `useMyNotifications` covers every existing and future notification
 * producer without a per-feature integration.
 *
 * Scope note: this uses the browser `Notification` API, which only fires
 * while a tab for the app is open (foreground or backgrounded). True
 * "closed app" push delivery needs Firebase Cloud Messaging (a VAPID key +
 * service worker registered against the project's own Firebase console),
 * which isn't set up in this repo and needs project-owner credentials to add.
 */

const PERMISSION_KEY = 'firmicore.notifications.permissionPrompted';
const SOUND_ENABLED_KEY = 'firmicore.notifications.soundEnabled';

export function isDeviceNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isDeviceNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestDeviceNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isDeviceNotificationSupported()) return 'unsupported';
  try {
    localStorage.setItem(PERMISSION_KEY, '1');
  } catch {
    // localStorage may be unavailable (private mode); permission still works.
  }
  return Notification.requestPermission();
}

export function hasPromptedForPermission(): boolean {
  try {
    return localStorage.getItem(PERMISSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function isNotificationSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(SOUND_ENABLED_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

let sharedAudioContext: AudioContext | null = null;

/** Two-tone chime synthesized with the Web Audio API — no binary asset to ship or fetch. */
export function playNotificationSound(): void {
  if (!isNotificationSoundEnabled()) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!sharedAudioContext) sharedAudioContext = new Ctx();
    const ctx = sharedAudioContext;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const tones = [{ freq: 880, start: 0, dur: 0.12 }, { freq: 1320, start: 0.1, dur: 0.16 }];
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0, now + tone.start);
      gain.gain.linearRampToValueAtTime(0.18, now + tone.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur + 0.02);
    }
  } catch {
    // Audio can fail silently (autoplay policy before first user gesture) — non-critical.
  }
}

export function showDeviceNotification(title: string, options?: NotificationOptions & { onClick?: () => void }): void {
  if (!isDeviceNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    const { onClick, ...rest } = options ?? {};
    const n = new Notification(title, { icon: '/android-chrome-192x192.png', ...rest });
    if (onClick) n.onclick = () => {
      window.focus();
      onClick();
      n.close();
    };
  } catch {
    // Non-critical — the in-app bell already carries the notification.
  }
}
