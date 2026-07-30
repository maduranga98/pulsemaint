import { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useMachineHealthMap } from '../../../hooks/dashboard/useMachineHealthMap';
import type { MachineHealthDoc } from '../../../types/analytics.types';

interface FactoryFloorMapProps {
  companyId: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  operational: { label: 'Operational', color: '#10B981' },
  breakdown: { label: 'Breakdown', color: '#EF4444' },
  maintenance: { label: 'Under Maintenance', color: '#F59E0B' },
  pm_in_progress: { label: 'PM In Progress', color: '#1A56DB' },
  decommissioned: { label: 'Decommissioned', color: '#374151' },
};

const WO_OPEN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'];

interface MachineWo { woNumber: string; woType: string; status: string; }

export default function FactoryFloorMap({ companyId }: FactoryFloorMapProps) {
  const { machines, loading, error } = useMachineHealthMap(companyId);
  const [selected, setSelected] = useState<MachineHealthDoc | null>(null);
  const [wos, setWos] = useState<MachineWo[]>([]);
  const [woLoading, setWoLoading] = useState(false);

  // Only machines that need attention now: in breakdown, or carrying an open
  // work order. Keeps the floor map to what a supervisor is actively driving.
  const attention = machines.filter(
    (m) => m.currentStatus === 'breakdown' || m.openWoCount > 0 || m.openBreakdownCount > 0,
  );

  async function openMachine(m: MachineHealthDoc) {
    setSelected(m);
    setWos([]);
    setWoLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'workOrders'), where('machineId', '==', m.machineId), limit(25)),
      );
      const rows = snap.docs
        .map((d) => d.data() as MachineWo)
        .filter((w) => WO_OPEN_STATUSES.includes(String(w.status)));
      setWos(rows);
    } catch {
      setWos([]);
    } finally {
      setWoLoading(false);
    }
  }

  return (
    <DashboardWidget
      title="Factory Floor Map"
      loading={loading}
      error={error}
      action={<span className="text-xs text-[#8BA3BF]">{attention.length} need attention</span>}
    >
      {attention.length === 0 ? (
        <EmptyState message="No machines in breakdown or with open work orders" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto p-0.5">
          {attention.map((m) => {
            const meta = STATUS_META[m.currentStatus] ?? { label: m.currentStatus, color: '#8BA3BF' };
            const isBreakdown = m.currentStatus === 'breakdown';
            return (
              <button
                key={m.machineId}
                onClick={() => void openMachine(m)}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all ${isBreakdown ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: `${meta.color}12`, borderColor: `${meta.color}40` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F0F4F8]">{m.machineName}</p>
                  <p className="truncate text-[11px]" style={{ color: meta.color }}>{meta.label}</p>
                </div>
                {m.openWoCount > 0 && (
                  <span className="shrink-0 rounded-full bg-[#1A56DB]/20 px-2 py-0.5 text-[10px] font-semibold text-[#5B8DEF]">
                    {m.openWoCount} WO
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Machine popup: name, location, and the open WO type(s). */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-[Sora] text-lg font-bold text-[#F0F4F8]">{selected.machineName}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[#8BA3BF]">
                  <MapPin className="h-3 w-3" /> {selected.location || 'No location set'}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-[#8BA3BF] hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-[#0A1628] px-3 py-2 text-sm">
              <span className="text-[#8BA3BF]">Status</span>
              <span style={{ color: (STATUS_META[selected.currentStatus]?.color) ?? '#8BA3BF' }} className="font-semibold capitalize">
                {(STATUS_META[selected.currentStatus]?.label) ?? selected.currentStatus}
              </span>
            </div>

            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8BA3BF]">Open Work Orders</p>
              {woLoading ? (
                <p className="text-sm text-[#8BA3BF]">Loading…</p>
              ) : wos.length === 0 ? (
                <p className="text-sm text-[#8BA3BF]">No open work orders.</p>
              ) : (
                <div className="space-y-1.5">
                  {wos.map((w) => (
                    <div key={w.woNumber} className="flex items-center justify-between rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-1.5 text-sm">
                      <span className="font-mono text-xs text-[#8BA3BF]">{w.woNumber}</span>
                      <span className="rounded bg-[#1A56DB]/20 px-2 py-0.5 text-xs font-semibold text-[#5B8DEF]">{String(w.woType || 'WO').replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
