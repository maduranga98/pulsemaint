interface Props {
  allChecked: boolean;
  onConfirm: () => void;
  isLoading: boolean;
  totalItems: number;
  checkedCount: number;
}

export function IssueConfirmButton({ allChecked, onConfirm, isLoading, totalItems, checkedCount }: Props) {
  const isDisabled = !allChecked || isLoading;

  return (
    <button
      onClick={onConfirm}
      disabled={isDisabled}
      className={`w-full min-h-[64px] rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-colors ${
        isDisabled
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
      }`}
    >
      {isLoading ? (
        <>
          <svg
            className="w-6 h-6 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          Confirming Issue…
        </>
      ) : (
        `Confirm Issue (${checkedCount}/${totalItems} checked)`
      )}
    </button>
  );
}
