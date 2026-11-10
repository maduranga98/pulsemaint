import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { msUntilNextSwitch, resolveTheme, type ResolvedTheme } from '@/lib/theme/themeMode';

const META_COLOR: Record<ResolvedTheme, string> = { dark: '#0A1628', light: '#EEF2F8' };

/**
 * Applies the chosen theme to <html data-theme> for as long as the calling
 * screen is mounted, and takes it off again afterwards — screens that don't
 * call this (platform console, public pages) keep their own fixed look.
 * In Auto it re-checks at the next 06:00 / 18:00 and when the tab is shown again.
 */
export function useAppTheme(): ResolvedTheme {
  const mode = useThemeStore((s) => s.mode);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

  useEffect(() => {
    setResolved(resolveTheme(mode));
    if (mode !== 'auto') return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setResolved(resolveTheme('auto'));
      timer = setTimeout(tick, msUntilNextSwitch());
    };
    timer = setTimeout(tick, msUntilNextSwitch());
    const onVisible = () => {
      if (document.visibilityState === 'visible') setResolved(resolveTheme('auto'));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousMeta = meta?.getAttribute('content') ?? null;
    root.dataset.theme = resolved;
    meta?.setAttribute('content', META_COLOR[resolved]);
    return () => {
      delete root.dataset.theme;
      if (meta && previousMeta) meta.setAttribute('content', previousMeta);
    };
  }, [resolved]);

  return resolved;
}
