import { useTranslation } from 'react-i18next';
import { Moon, Sun, SunMoon } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { nextThemeMode, type ThemeMode } from '@/lib/theme/themeMode';

const ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, auto: SunMoon };

/** Header button: each press moves Light → Dark → Auto (by time of day). */
export default function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const Icon = ICONS[mode];
  const name = t(`common.theme.${mode}`);
  const label = `${t('common.theme.label')}: ${mode === 'auto' ? t('common.theme.autoHint') : name}`;

  return (
    <button
      type="button"
      data-theme-switch={mode}
      onClick={() => setMode(nextThemeMode(mode))}
      aria-label={label}
      title={label}
      className={`theme-switch flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#1E3A5F] bg-[#142849] px-2.5 text-[12px] font-semibold text-[#D5DEEA] transition-colors hover:bg-[#1E3A5F] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A56DB] ${className}`}
    >
      <Icon key={mode} className="theme-switch-icon h-4 w-4" aria-hidden="true" />
      <span className="hidden md:inline">{name}</span>
    </button>
  );
}
