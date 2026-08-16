import type { ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface LightAnalyticsWidgetProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

// Light-themed counterpart to DashboardWidget — white background, dark
// high-contrast text, larger title — for pages that intentionally break from
// the app's default dark dashboard chrome for readability (e.g. the store
// keeper's Inventory Analytics tab).
export default function LightAnalyticsWidget({
  title,
  children,
  loading = false,
  error = null,
  onRetry,
  className = '',
}: LightAnalyticsWidgetProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full ${className}`}>
      <div className="px-5 py-4 border-b border-gray-100 min-h-[4.5rem] flex items-center">
        <h3 className="text-base font-semibold text-gray-900 font-[Sora] leading-snug">{title}</h3>
      </div>
      <div className="p-5">
        {loading && (
          <div className="h-56 rounded-lg bg-gray-100 animate-pulse" />
        )}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-sm font-medium text-gray-900">Failed to load data</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
          </div>
        )}
        {!loading && !error && children}
      </div>
    </div>
  );
}
