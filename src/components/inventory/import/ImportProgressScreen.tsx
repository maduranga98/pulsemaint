import { Loader2 } from 'lucide-react';

interface ImportProgressScreenProps {
  current: number;
  total: number;
  fileName: string;
}

export function ImportProgressScreen({ current, total, fileName }: ImportProgressScreenProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="max-w-lg mx-auto flex flex-col items-center gap-8 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <h2 className="text-xl font-bold text-gray-900 font-[Sora]">Importing Parts…</h2>
        <p className="text-sm text-gray-500 truncate max-w-xs">
          {fileName}
        </p>
      </div>

      <div className="w-full space-y-2">
        <div className="flex justify-between text-sm font-medium text-gray-700">
          <span>Importing {current} of {total} parts</span>
          <span>{percent}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 text-center">
        Do not navigate away from this page while the import is in progress.
      </div>
    </div>
  );
}
