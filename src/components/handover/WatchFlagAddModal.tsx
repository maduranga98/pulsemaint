import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { DraftWatchFlag, WatchLevel } from '@/types/handover.types';

interface WatchFlagAddModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (flag: DraftWatchFlag) => void;
}

type MachineOption = {
  id: string;
  name: string;
  location: string;
};

type BreakdownOption = {
  id: string;
  machineId: string;
  ticketNumber: string;
  severity: string;
  status: string;
};

const OPEN_BREAKDOWN_STATUSES = ['reported', 'acknowledged', 'triage_in_progress', 'assigned', 'en_route', 'repair_in_progress', 'on_hold_parts', 'on_hold_approval'];

export function WatchFlagAddModal({ open, onClose, onAdd }: WatchFlagAddModalProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;
  const siteIds = userProfile?.siteIds;

  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [watchLevel, setWatchLevel] = useState<WatchLevel>('monitor');
  const [reason, setReason] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [breakdowns, setBreakdowns] = useState<BreakdownOption[]>([]);
  const [breakdownsLoading, setBreakdownsLoading] = useState(false);
  const [linkedBreakdownId, setLinkedBreakdownId] = useState('');

  // Live machine registry — reflects new machines / status changes the
  // instant they happen, instead of a one-shot fetch when the modal opens.
  useEffect(() => {
    if (!open || !companyId) return;
    setMachinesLoading(true);
    const siteIdList = siteIds && siteIds.length > 0 ? siteIds : [companyId];
    const unsub = onSnapshot(
      query(collection(db, 'machines'), where('siteId', 'in', siteIdList.slice(0, 10))),
      (snap) => {
        setMachines(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: (data.name as string) ?? d.id,
              location: (data.location as string) ?? '',
            };
          }).sort((a, b) => a.name.localeCompare(b.name)),
        );
        setMachinesLoading(false);
      },
      (err) => {
        console.error('Failed to load machines for watch flag modal', err);
        setMachinesLoading(false);
      },
    );
    return () => unsub();
  }, [open, companyId, siteIds]);

  // Live open breakdown tickets for whichever machine is currently
  // selected, so "Linked Breakdown" is a real pick from the breakdown
  // registry instead of a free-typed document ID.
  useEffect(() => {
    setLinkedBreakdownId('');
    if (!open || !companyId || !selectedMachineId) {
      setBreakdowns([]);
      return;
    }
    setBreakdownsLoading(true);
    // Filtered client-side by machine + open status (rather than more
    // `where` clauses) to match the same pattern CreateWODrawer's linked-
    // breakdown picker uses, avoiding a composite index requirement.
    const unsub = onSnapshot(
      query(collection(db, 'breakdown_tickets'), where('siteId', '==', companyId)),
      (snap) => {
        setBreakdowns(
          snap.docs
            .map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                machineId: (data.machineId as string) ?? '',
                ticketNumber: (data.ticketNumber as string) ?? d.id,
                severity: (data.severity as string) ?? '',
                status: (data.status as string) ?? '',
              };
            })
            .filter((b) => b.machineId === selectedMachineId && OPEN_BREAKDOWN_STATUSES.includes(b.status)),
        );
        setBreakdownsLoading(false);
      },
      (err) => {
        console.error('Failed to load breakdowns for watch flag modal', err);
        setBreakdownsLoading(false);
      },
    );
    return () => unsub();
  }, [open, companyId, selectedMachineId]);

  useEffect(() => {
    if (!open) {
      setSelectedMachineId('');
      setWatchLevel('monitor');
      setReason('');
      setRecommendedAction('');
      setLinkedBreakdownId('');
    }
  }, [open]);

  if (!open) return null;

  const selected = machines.find((m) => m.id === selectedMachineId);

  function add() {
    if (!selected || !reason || !recommendedAction) return;
    onAdd({
      machineId: selected.id,
      machineName: selected.name,
      machineLocation: selected.location,
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
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Machine</label>
            <select
              value={selectedMachineId}
              onChange={(event) => setSelectedMachineId(event.target.value)}
              className="min-h-12 w-full rounded-md border border-slate-200 px-3 text-sm"
            >
              <option value="">{machinesLoading ? 'Loading machines…' : 'Select a machine'}</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <input
            value={selected?.id ?? ''}
            readOnly
            placeholder="Machine ID"
            className="min-h-12 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
          />
          <input
            value={selected?.location ?? ''}
            readOnly
            placeholder="Location"
            className="min-h-12 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
          />
          <select value={watchLevel} onChange={(event) => setWatchLevel(event.target.value as WatchLevel)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm sm:col-span-2">
            <option value="critical_watch">Critical Watch</option>
            <option value="monitor">Monitor</option>
            <option value="info_only">Info Only</option>
          </select>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Watch reason" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          <textarea value={recommendedAction} onChange={(event) => setRecommendedAction(event.target.value)} placeholder="Recommended action" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Linked Breakdown (optional)</label>
            <select
              value={linkedBreakdownId}
              onChange={(event) => setLinkedBreakdownId(event.target.value)}
              disabled={!selectedMachineId}
              className="min-h-12 w-full rounded-md border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {!selectedMachineId
                  ? 'Select a machine first'
                  : breakdownsLoading
                    ? 'Loading breakdowns…'
                    : breakdowns.length === 0
                      ? 'No open breakdowns for this machine'
                      : 'None'}
              </option>
              {breakdowns.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.ticketNumber} · {b.severity} · {b.status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!selected || !reason || !recommendedAction}
          className="mt-4 min-h-12 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Add Watch Flag
        </button>
      </div>
    </div>
  );
}

export default WatchFlagAddModal;
