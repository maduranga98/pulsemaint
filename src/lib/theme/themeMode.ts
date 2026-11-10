// App colour theme. The user picks Light, Dark or Auto; Auto follows the
// clock on the device (light during the day, dark at night) rather than the
// operating-system setting, so a shared floor PC changes with the shift.

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'auto'];
export const THEME_STORAGE_KEY = 'firmicore:theme';
/** Dark navy is the look every existing user knows, so it stays the default. */
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

/** Auto is light from 06:00 up to (not including) 18:00 local time. */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 18;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

export function resolveTheme(mode: ThemeMode, now: Date = new Date()): ResolvedTheme {
  if (mode !== 'auto') return mode;
  const hour = now.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? 'light' : 'dark';
}

/** Light → Dark → Auto → Light … (the header button cycles through them). */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
}

/** Milliseconds until Auto next switches (the coming 06:00 or 18:00). */
export function msUntilNextSwitch(now: Date = new Date()): number {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  const hour = now.getHours();
  if (hour < DAY_START_HOUR) next.setHours(DAY_START_HOUR);
  else if (hour < DAY_END_HOUR) next.setHours(DAY_END_HOUR);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(DAY_START_HOUR);
  }
  return Math.max(1000, next.getTime() - now.getTime());
}
