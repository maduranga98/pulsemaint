import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, ArrowUpRight, X } from 'lucide-react';
import { useBacklog } from '../../hooks/useBacklog';
import { useMachines } from '../../hooks/useMachines';
import { useAuthStore } from '../../store/authStore';
import {
  computeRiskScore,
  HIGH_RISK_THRESHOLD,
  isHighRiskCritical,
  type BacklogItem,
  type RiskScale,
} from '../../types/backlog';

type SortKey = 'risk' | 'age' | 'criticality';

function ageInDays(item: BacklogItem): number {
  const ms = item.identifiedAt?.toMillis?.() ?? Date.now();
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

function riskColor(score: number): string {
  if (score >= HIGH_RISK_THRESHOLD) return 'bg-red-600 text-white';
  if (score >= 9) return 'bg-orange-500 text-white';
  if (score >= 4) return 'bg-amber-500 text-white';
  return 'bg-slate-400 text-white';
}

const STATUS_STYLE: Record<BacklogItem['status'], string> = {
  open: 'bg-blue-50 text-blue-700 ring-blue-200',
  scheduled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function BacklogTab() {
  const { items, loading, createBacklogItem, promoteToWorkOrder, updateStatus } = useBacklog();
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [showCreate, setShowCreate] = useState(false);

  const userProfile = useAuthStore((s) => s.userProfile);
  const role = userProfile?.role;
  const canManage = role === 'supervisor' || role === 'plant_manager' || role === 'admin';

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'age':
          return ageInDays(b) - ageInDays(a);
        case 'criticality':
          return (b.machineCriticality ?? 0) - (a.machineCriticality ?? 0);
        case 'risk':
        default:
          return (b.riskScore ?? 0) - (a.riskScore ?? 0);
      }
    });
    return copy;
  }, [items, sortKey]);

  const criticalAlerts = sorted.filter(
    (i) => i.status !== 'closed' && isHighRiskCritical(i),
  );

  return (
    <div className="space-y-4">
      {/* High-risk critical alert banner */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {criticalAlerts.length} high-risk item{criticalAlerts.length > 1 ? 's' : ''} on
                critical machine{criticalAlerts.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-700">
                Risk score ≥ {HIGH_RISK_THRESHOLD} — the plant manager has been alerted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Sort by</span>
          {([
            { key: 'risk', label: 'Risk' },
            { key: 'age', label: 'Age' },
            { key: 'criticality', label: 'Criticality' },
          ] as { key: SortKey; label: string }[]).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSortKey(s.key)}
              className={`px-3 py-1.5 rounded-lg font-medium ${
                sortKey === s.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Add Backlog Item
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-white animate-pulse rounded-lg shadow-sm" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-5xl mb-3">🗂️</p>
          <p>No deferred maintenance in the backlog.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Machine</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-center">Crit.</th>
                <th className="px-4 py-3 text-center">L × C</th>
                <th className="px-4 py-3 text-center">Risk</th>
                <th className="px-4 py-3 text-center">Age (d)</th>
                <th className="px-4 py-3 text-left">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.machineName}</p>
                    {item.machineFlaggedCritical && (
                      <span className="text-[10px] font-semibold text-red-600 uppercase">Critical</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-700 truncate" title={item.description}>
                      {item.description}
                    </p>
                    <p className="text-gray-400 text-xs truncate" title={item.deferredReason}>
                      Deferred: {item.deferredReason}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{item.machineCriticality}</td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {item.likelihood} × {item.consequence}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block min-w-7 px-2 py-0.5 rounded text-xs font-bold ${riskColor(item.riskScore)}`}
                    >
                      {item.riskScore}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{ageInDays(item)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ring-1 capitalize ${STATUS_STYLE[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {item.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => promoteToWorkOrder(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" /> Promote
                        </button>
                      )}
                      {item.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(item.id, 'closed')}
                          className="ml-2 px-2.5 py-1 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50"
                        >
                          Close
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateBacklogModal
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            const id = await createBacklogItem(payload);
            if (id) setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create modal
// ---------------------------------------------------------------------------

interface CreateBacklogModalProps {
  onClose: () => void;
  onCreate: (payload: Parameters<ReturnType<typeof useBacklog>['createBacklogItem']>[0]) => void;
}

function CreateBacklogModal({ onClose, onCreate }: CreateBacklogModalProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';
  const { machines } = useMachines({ siteId, pageSize: 100 });

  const [machineId, setMachineId] = useState('');
  const [description, setDescription] = useState('');
  const [deferredReason, setDeferredReason] = useState('');
  const [likelihood, setLikelihood] = useState<RiskScale>(3);
  const [consequence, setConsequence] = useState<RiskScale>(3);
  const [submitting, setSubmitting] = useState(false);

  const selectedMachine = machines.find((m) => m.id === machineId);
  const riskScore = computeRiskScore(likelihood, consequence);
  const canSubmit = machineId && description.trim() && deferredReason.trim();

  async function submit() {
    if (!selectedMachine || !canSubmit) return;
    setSubmitting(true);
    await onCreate({
      machineId: selectedMachine.id,
      machineName: selectedMachine.name,
      machineCriticality: selectedMachine.criticality,
      machineFlaggedCritical: selectedMachine.criticality >= 5,
      description: description.trim(),
      deferredReason: deferredReason.trim(),
      likelihood,
      consequence,
    });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Add Backlog Item</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Machine *</label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Select a machine…</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (criticality {m.criticality})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What deferred maintenance is needed?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deferred Reason *</label>
            <input
              type="text"
              value={deferredReason}
              onChange={(e) => setDeferredReason(e.target.value)}
              placeholder="Why is it being deferred?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Likelihood (1–5)</label>
              <select
                value={likelihood}
                onChange={(e) => setLikelihood(Number(e.target.value) as RiskScale)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Consequence (1–5)</label>
              <select
                value={consequence}
                onChange={(e) => setConsequence(Number(e.target.value) as RiskScale)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Risk Score</span>
            <span className={`px-2.5 py-1 rounded text-sm font-bold ${riskColor(riskScore)}`}>
              {riskScore}
            </span>
          </div>
          {riskScore >= HIGH_RISK_THRESHOLD && selectedMachine && selectedMachine.criticality >= 5 && (
            <p className="text-xs text-red-600">
              This will trigger a plant-manager alert (high risk on a critical machine).
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? 'Saving…' : 'Add to Backlog'}
          </button>
        </div>
      </div>
    </div>
  );
}
