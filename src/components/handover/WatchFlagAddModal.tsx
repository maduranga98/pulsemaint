import { X } from 'lucide-react';
import { useState } from 'react';
import type { DraftWatchFlag, WatchLevel } from '@/types/handover.types';

interface WatchFlagAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (flag: DraftWatchFlag) => void;
}

export function WatchFlagAddModal({ open, onClose, onAdd }: WatchFlagAddModalProps) {
  const [machineName, setMachineName] = useState('');
  const [machineId, setMachineId] = useState('');
  const [machineLocation, setMachineLocation] = useState('');
  const [watchLevel, setWatchLevel] = useState<WatchLevel>('monitor');
  const [reason, setReason] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [linkedBreakdownId, setLinkedBreakdownId] = useState('');

  if (!open) return null;

  function add() {
    if (!machineName || !reason || !recommendedAction) return;
    onAdd({
      machineId: machineId || machineName,
      machineName,
      machineLocation,
      watchLevel,
      reason,
      recommendedAction,
      linkedBreakdownId: linkedBreakdownId || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-[Sora] text-lg font-bold text-slate-950">Add Watch Machine</h2>
          <button type="button" onClick={onClose} className="min-h-12 min-w-12 rounded-md text-slate-500" aria-label="Close">
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={machineName} onChange={(event) => setMachineName(event.target.value)} placeholder="Machine name" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
          <input value={machineId} onChange={(event) => setMachineId(event.target.value)} placeholder="Machine ID" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
          <input value={machineLocation} onChange={(event) => setMachineLocation(event.target.value)} placeholder="Location" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
          <select value={watchLevel} onChange={(event) => setWatchLevel(event.target.value as WatchLevel)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm">
            <option value="critical_watch">Critical Watch</option>
            <option value="monitor">Monitor</option>
            <option value="info_only">Info Only</option>
          </select>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Watch reason" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          <textarea value={recommendedAction} onChange={(event) => setRecommendedAction(event.target.value)} placeholder="Recommended action" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          <input value={linkedBreakdownId} onChange={(event) => setLinkedBreakdownId(event.target.value)} placeholder="Linked breakdown ID" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm sm:col-span-2" />
        </div>
        <button type="button" onClick={add} className="mt-4 min-h-12 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white">Add Watch Flag</button>
      </div>
    </div>
  );
}

export default WatchFlagAddModal;
