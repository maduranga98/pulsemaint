import { AlertTriangle } from 'lucide-react';

export default function GenerationErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-[#FCA5A5]" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#FCA5A5]">{message}</p>
          <button type="button" onClick={onRetry} className="mt-2 min-h-10 rounded-lg border border-[#EF4444]/40 px-3 text-xs font-semibold text-[#FECACA]">
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
