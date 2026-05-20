interface Props {
  item: {
    id: string;
    partName: string;
    partNumber: string;
    unit: string;
    quantityApproved: number;
    storeLocation?: string;
    isCritical: boolean;
  };
  checked: boolean;
  skipped: boolean;
  onCheck: () => void;
  onSkip: () => void;
}

export function IssuePartCheckItem({ item, checked, skipped, onCheck, onSkip }: Props) {
  return (
    <div
      className={`flex items-start gap-4 min-h-[64px] p-4 rounded-xl border transition-colors ${
        checked
          ? 'bg-green-50 border-green-200'
          : skipped
          ? 'bg-gray-50 border-gray-200'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onCheck}
        disabled={skipped}
        aria-pressed={checked}
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
          checked
            ? 'bg-green-500 border-green-500'
            : skipped
            ? 'border-gray-300 bg-gray-200 cursor-not-allowed'
            : 'border-gray-400 hover:border-green-500'
        }`}
      >
        {checked && (
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`text-xl font-bold leading-tight ${
                skipped ? 'line-through text-gray-400' : 'text-gray-900'
              }`}
            >
              {item.partName}
            </p>
            <p className="font-mono text-sm text-gray-500 mt-0.5">{item.partNumber}</p>

            {item.storeLocation && (
              <p className="text-base text-gray-700 mt-1.5 font-medium">
                📍 {item.storeLocation}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-lg font-semibold text-gray-800">
                Issue: {item.quantityApproved} {item.unit}
              </span>
              {item.isCritical && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                  Critical
                </span>
              )}
            </div>
          </div>

          {/* Skip toggle */}
          <button
            onClick={onSkip}
            disabled={checked}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors shrink-0 mt-1 ${
              skipped
                ? 'border-gray-400 bg-gray-200 text-gray-700'
                : checked
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            {skipped ? 'Undo skip' : 'Cannot find — skip'}
          </button>
        </div>
      </div>
    </div>
  );
}
