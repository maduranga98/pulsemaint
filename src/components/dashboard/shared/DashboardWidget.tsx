import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import LoadingSkeleton from './LoadingSkeleton';

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  /** Kept so callers still compile — no "LIVE" label is shown any more. */
  live?: boolean;
  action?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

export default function DashboardWidget({
  title,
  children,
  loading = false,
  error = null,
  action,
  onRetry,
  className = '',
}: DashboardWidgetProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`relative bg-[#0F1E35] border border-[#1E3A5F] rounded-xl overflow-hidden hover:border-[#2E5A8F] transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E3A5F]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">{title}</h3>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {/* Content */}
      <div className="p-5">
        {loading && <LoadingSkeleton variant="card" />}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-[#EF4444] mb-2" />
            <p className="text-sm text-[#F0F4F8]">{t('common.ui.failedToLoad')}</p>
            <p className="text-xs text-[#8BA3BF] mt-1">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1A56DB] bg-[#1A56DB]/10 rounded-md hover:bg-[#1A56DB]/20 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                {t('common.ui.retry')}
              </button>
            )}
          </div>
        )}
        {!loading && !error && children}
      </div>
    </div>
  );
}
