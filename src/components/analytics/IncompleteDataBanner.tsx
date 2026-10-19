import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Shown when some records couldn't be loaded (permissions, network) while
 * computing the figures, so they read as incomplete instead of silently low.
 */
export function IncompleteDataBanner({ sources }: { sources?: string[] }) {
  const { t } = useTranslation();
  if (!sources || sources.length === 0) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t('common.analytics.incompleteData', { sources: sources.join(', ') })}</span>
    </div>
  );
}
