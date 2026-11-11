import { create } from 'zustand';

/** Chrome's install event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Held until the person presses "Install app"; a browser allows one use. */
  promptEvent: BeforeInstallPromptEvent | null;
  /** Running as the installed app (own window) or just installed. */
  standalone: boolean;
  /** Opens the browser's install window. Resolves true when accepted. */
  install: () => Promise<boolean>;
}

function readStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

export const useInstallStore = create<InstallState>((set, get) => ({
  promptEvent: null,
  standalone: typeof window !== 'undefined' && readStandalone(),
  install: async () => {
    const event = get().promptEvent;
    if (!event) return false;
    // The event can be used once, whatever the answer.
    set({ promptEvent: null });
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome === 'accepted';
    } catch {
      return false;
    }
  },
}));

let started = false;

/**
 * Start listening for the browser's install offer. Called from `main.tsx`
 * before React renders: the event fires once, early, and is lost otherwise.
 */
export function initInstallPrompt(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own mini-bar away; our button opens the window.
    e.preventDefault();
    useInstallStore.setState({ promptEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    useInstallStore.setState({ promptEvent: null, standalone: true });
  });
  try {
    window
      .matchMedia('(display-mode: standalone)')
      .addEventListener('change', () => useInstallStore.setState({ standalone: readStandalone() }));
  } catch {
    // Old browsers without MediaQueryList events: the value from load stays.
  }
}
