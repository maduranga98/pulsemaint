import type { ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import LiveIndicator from './LiveIndicator';
import LoadingSkeleton from './LoadingSkeleton';

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
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
  live = false,
  action,
  onRetry,
  className = '',
}: DashboardWidgetProps) {
  return (
    <div
      className={`relative bg-[#0F1E35] border border-[#1E3A5F] rounded-xl overflow-hidden hover:border-[#2E5A8F] transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E3A5F]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#F0F4F8] font-[Sora]">{title}</h3>
          {live && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#10B981] font-medium uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Live
            </span>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {/* Content */}
      <div className="p-5">
        {loading && <LoadingSkeleton variant="card" />}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-[#EF4444] mb-2" />
            <p className="text-sm text-[#F0F4F8]">Failed to load data</p>
            <p className="text-xs text-[#8BA3BF] mt-1">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1A56DB] bg-[#1A56DB]/10 rounded-md hover:bg-[#1A56DB]/20 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        )}
        {!loading && !error && children}
      </div>

      {live && <LiveIndicator />}
    </div>
  );
}
