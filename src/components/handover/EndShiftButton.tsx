import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Play } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useHandoverStore } from '@/store/handover.store';
import { formatDuration } from '@/utils/handover.utils';
import EndShiftConfirmModal from './EndShiftConfirmModal';

export function EndShiftButton() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.userProfile?.role);
  const currentShift = useHandoverStore((state) => state.currentShift);
  const shiftStartTime = useHandoverStore((state) => state.shiftStartTime);
  const isShiftActive = useHandoverStore((state) => state.isShiftActive);
  const isCompilingStats = useHandoverStore((state) => state.isCompilingStats);
  const startShift = useHandoverStore((state) => state.startShift);
  const endShift = useHandoverStore((state) => state.endShift);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  if (role !== 'supervisor' && role !== 'admin') return null;

  const elapsed = shiftStartTime ? formatDuration(Date.now() - shiftStartTime.getTime()) : 'Start';

  async function handleStart() {
    setStartError(null);
    setStarting(true);
    try {
      await startShift();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start shift');
    } finally {
      setStarting(false);
    }
  }

  async function confirm() {
    await endShift();
    setOpen(false);
    navigate('/app/shift/handover/create');
  }

  if (!isShiftActive) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={starting}
          className="hidden min-h-10 items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm sm:inline-flex disabled:opacity-60"
        >
          <Play className="h-4 w-4" />
          {starting ? 'Starting…' : 'Start Shift'}
        </button>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={starting}
          className="fixed bottom-4 right-4 z-30 min-h-12 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg sm:hidden disabled:opacity-60"
        >
          {starting ? 'Starting…' : 'Start Shift'}
        </button>
        {startError && (
          <span className="hidden max-w-[220px] text-[11px] font-semibold text-red-400 sm:inline">{startError}</span>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-h-10 items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm sm:inline-flex"
      >
        <Clock className="h-4 w-4" />
        End Shift
        <span className="rounded bg-white/20 px-1.5 py-0.5">{currentShift?.shiftName ?? elapsed}</span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 min-h-12 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg sm:hidden"
      >
        End Shift
      </button>
      <EndShiftConfirmModal
        open={open}
        shift={currentShift}
        shiftStartTime={shiftStartTime}
        loading={isCompilingStats}
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
      />
    </>
  );
}

export default EndShiftButton;
