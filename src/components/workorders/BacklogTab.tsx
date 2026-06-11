import { useState } from 'react';
import { AlertTriangle, Plus, X, TrendingUp, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { useBacklog } from '../../hooks/useBacklog';
import { getRiskLevel } from '../../lib/backlogUtils';
import type { CreateBacklogItemPayload } from '../../types/backlog';

const LIKELIHOOD_LABELS: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost Certain',
};

const CONSEQUENCE_LABELS: Record<number, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Catastrophic',
};

function RiskBadge({ score }: { score: number }) {
  const level = getRiskLevel(score);
  const cls =
    level === 'high'
      ? 'bg-red-100 text-red-700'
      : level === 'medium'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {score} {level.toUpperCase()}
    </span>
  );
}

export function BacklogTab() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId || '';
  const role = userProfile?.role ?? '';
  const isSupervisor = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'].includes(role);

  const { items, loading, error, highRiskAlerts, addItem, promoteToWO, closeItem } =
    useBacklog({ siteId });

  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState<Omit<CreateBacklogItemPayload, 'machineId'> & { machineId: string }>({
    machineId: '',
    machineName: '',
    machineLocation: '',
    machineDepartment: '',
    machineCriticality: 3,
    description: '',
    deferredReason: '',
    likelihood: 3,
    consequence: 3,
  });

  const previewRisk = form.likelihood * form.consequence;

  // Sort state
  type SortKey = 'riskScore' | 'age';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    let diff = 0;
    if (sortKey === 'riskScore') {
      diff = a.riskScore - b.riskScore;
    } else {
      const aMs = (a.identifiedAt as any)?.toMillis?.() ?? 0;
      const bMs = (b.identifiedAt as any)?.toMillis?.() ?? 0;
      diff = aMs - bMs; // older = higher age
    }
    return sortDir === 'desc' ? -diff : diff;
  });

  async function handleAdd() {
    if (!user || !userProfile) return;
    if (!form.machineName.trim() || !form.description.trim()) {
      toast.error('Machine name and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      await addItem(form, user.uid, userProfile.fullName);
      toast.success('Backlog item added.');
      setShowAddForm(false);
      setForm({
        machineId: '',
        machineName: '',
        machineLocation: '',
        machineDepartment: '',
        machineCriticality: 3,
        description: '',
        deferredReason: '',
        likelihood: 3,
        consequence: 3,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add item.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePromote(item: typeof items[0]) {
    if (!user || !userProfile) return;
    try {
      const woId = await promoteToWO(item, user.uid, userProfile.fullName);
      toast.success(`Work Order created: ${woId.slice(0, 8)}…`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to promote.');
    }
  }

  async function handleClose(id: string) {
    const ok = await closeItem(id);
    if (ok) toast.success('Item closed.');
    else toast.error('Failed to close item.');
  }

  function getDaysAgo(ts: any): number {
    const ms = ts?.toMillis?.() ?? Number(ts) ?? Date.now();
    return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Maintenance Backlog</h2>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
            {items.length}
          </span>
        </div>
        {isSupervisor && (
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Cancel' : 'Add Item'}
          </button>
        )}
      </div>

      {/* High-risk alert banner */}
      {highRiskAlerts.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {highRiskAlerts.length} high-risk item{highRiskAlerts.length > 1 ? 's' : ''} require attention
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Critical machines with risk score ≥ 15 are awaiting action.
            </p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && isSupervisor && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Add Backlog Item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Machine Name *</label>
              <input
                type="text"
                value={form.machineName}
                onChange={(e) => setForm((f) => ({ ...f, machineName: e.target.value }))}
                placeholder="e.g. Hydraulic Press 1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Criticality</label>
              <select
                value={form.machineCriticality}
                onChange={(e) => setForm((f) => ({ ...f, machineCriticality: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v} – {v === 1 ? 'Critical' : v === 2 ? 'High' : v === 3 ? 'Medium' : v === 4 ? 'Low' : 'Minimal'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input
                type="text"
                value={form.machineLocation}
                onChange={(e) => setForm((f) => ({ ...f, machineLocation: e.target.value }))}
                placeholder="e.g. Building A, Bay 3"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <input
                type="text"
                value={form.machineDepartment}
                onChange={(e) => setForm((f) => ({ ...f, machineDepartment: e.target.value }))}
                placeholder="e.g. Production"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Describe the maintenance work that needs to be done…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason for Deferral</label>
            <input
              type="text"
              value={form.deferredReason}
              onChange={(e) => setForm((f) => ({ ...f, deferredReason: e.target.value }))}
              placeholder="e.g. Parts on order, Production schedule constraints"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Likelihood</label>
              <select
                value={form.likelihood}
                onChange={(e) => setForm((f) => ({ ...f, likelihood: Number(e.target.value) as 1|2|3|4|5 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v} – {LIKELIHOOD_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Consequence</label>
              <select
                value={form.consequence}
                onChange={(e) => setForm((f) => ({ ...f, consequence: Number(e.target.value) as 1|2|3|4|5 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v} – {CONSEQUENCE_LABELS[v]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Risk Score Preview:</span>
              <RiskBadge score={previewRisk} />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={submitting}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add to Backlog'}
            </button>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading backlog…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 text-sm">
            No backlog items. Use "Add Item" to defer maintenance work.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Machine</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">L / C</th>
                <th
                  className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('riskScore')}
                >
                  Risk Score {sortKey === 'riskScore' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('age')}
                >
                  Age {sortKey === 'age' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.machineName}</p>
                    {item.machineLocation && (
                      <p className="text-xs text-gray-400">{item.machineLocation}</p>
                    )}
                    <span className="inline-block text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mt-0.5">
                      C{item.machineCriticality}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-800 line-clamp-2">{item.description}</p>
                    {item.deferredReason && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.deferredReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {item.likelihood} / {item.consequence}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge score={item.riskScore} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {getDaysAgo(item.identifiedAt)}d
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'open'
                          ? 'bg-blue-100 text-blue-700'
                          : item.status === 'scheduled'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {isSupervisor && item.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => handlePromote(item)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <TrendingUp className="w-3 h-3" /> Promote → WO
                        </button>
                      )}
                      {item.linkedWOId && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          <Eye className="w-3 h-3" /> WO Linked
                        </span>
                      )}
                      {isSupervisor && ['open', 'scheduled'].includes(item.status) && (
                        <button
                          type="button"
                          onClick={() => handleClose(item.id)}
                          className="px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-50"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
