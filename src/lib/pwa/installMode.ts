/**
 * "Install app" (PWA): which way, if any, this browser can put FirmiCore on
 * the home screen / desktop.
 *
 *  - `prompt`  Chrome / Edge / Samsung Internet (Android + desktop) handed us
 *              a `beforeinstallprompt` event — one click opens the browser's
 *              own install window.
 *  - `ios`     iPhone / iPad have no install event: the person adds it from
 *              the Share menu, so we show the steps instead.
 *  - `hidden`  already running as the installed app, or the browser offers
 *              no install at all (e.g. Firefox desktop).
 */
export type InstallMode = 'prompt' | 'ios' | 'hidden';

export interface InstallEnvironment {
  /** Running in its own window (installed), not in a browser tab. */
  standalone: boolean;
  /** The browser fired `beforeinstallprompt` and we still hold the event. */
  hasPrompt: boolean;
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

/** iPhone, iPod and iPad — iPadOS reports itself as a Mac with a touch screen. */
export function isIosDevice(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;
  return /Mac/i.test(platform || userAgent) && maxTouchPoints > 1;
}

export function installMode(env: InstallEnvironment): InstallMode {
  if (env.standalone) return 'hidden';
  if (env.hasPrompt) return 'prompt';
  if (isIosDevice(env.userAgent, env.platform, env.maxTouchPoints)) return 'ios';
  return 'hidden';
}
