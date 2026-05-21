import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useHandoverStore } from '@/store/handover.store';
import { formatDuration } from '@/utils/handover.utils';
import EndShiftConfirmModal from './EndShiftConfirmModal';

export function EndShiftButton() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.userProfile?.role);
  const currentShift = useHandoverStore((state) => state.currentShift);
  const shiftStartTime = useHandoverStore((state) => state.shiftStartTime);
  const isCompilingStats = useHandoverStore((state) => state.isCompilingStats);
  const endShift = useHandoverStore((state) => state.endShift);
  const [open, setOpen] = useState(false);

  if (role !== 'supervisor' && role !== 'admin') return null;

  const elapsed = shiftStartTime ? formatDuration(Date.now() - shiftStartTime.getTime()) : 'Start';

  async function confirm() {
    await endShift();
    setOpen(false);
    navigate('/app/shift/handover/create');
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
