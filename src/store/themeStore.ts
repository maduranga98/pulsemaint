import { create } from 'zustand';
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY, isThemeMode, type ThemeMode } from '@/lib/theme/themeMode';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

function readStored(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(saved) ? saved : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStored(),
  setMode: (mode) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage blocked — the choice still applies until the page reloads.
    }
    set({ mode });
  },
}));
