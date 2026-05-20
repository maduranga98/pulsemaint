import { useState } from 'react';
import { useHandoverStore } from '@/store/handover.store';

interface AcceptShiftButtonProps {
  handoverId: string;
}

export function AcceptShiftButton({ handoverId }: AcceptShiftButtonProps) {
  const acceptHandover = useHandoverStore((state) => state.acceptHandover);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (confirming) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-medium text-blue-950">By accepting, you confirm you reviewed the shift briefing and take responsibility for this shift.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setConfirming(false)} className="min-h-12 rounded-md border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700">Cancel</button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void acceptHandover(handoverId).finally(() => setLoading(false));
            }}
            className="min-h-14 flex-1 rounded-md bg-blue-600 px-4 font-[Sora] text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? 'Accepting...' : 'Confirm Acceptance'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className="min-h-14 w-full rounded-md bg-blue-600 px-4 font-[Sora] text-sm font-bold text-white">
      Accept Shift & Take Responsibility
    </button>
  );
}

export default AcceptShiftButton;
