import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { AlertCircle, Bell, Plus, Search } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { Breakdown, BreakdownStatus, BreakdownSeverity } from '../../types/breakdown';

const STATUS_LABEL: Record<BreakdownStatus, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  triage_in_progress: 'In Triage',
  assigned: 'Assigned',
  en_route: 'En Route',
  repair_in_progress: 'In Progress',
  on_hold_parts: 'On Hold (Parts)',
  on_hold_approval: 'On Hold (Approval)',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLOR: Record<BreakdownStatus, string> = {
  reported: 'bg-red-50 text-red-700 ring-red-200',
  acknowledged: 'bg-amber-50 text-amber-700 ring-amber-200',
  triage_in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  en_route: 'bg-blue-50 text-blue-700 ring-blue-200',
  repair_in_progress: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  on_hold_parts: 'bg-orange-50 text-orange-700 ring-orange-200',
  on_hold_approval: 'bg-orange-50 text-orange-700 ring-orange-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

// Repair progress (%) per lifecycle stage — used for the at-a-glance progress bar.
const STATUS_PROGRESS: Record<BreakdownStatus, number> = {
  reported: 5,
  acknowledged: 15,
  triage_in_progress: 25,
  assigned: 40,
  en_route: 55,
  repair_in_progress: 70,
  on_hold_parts: 60,
  on_hold_approval: 60,
  resolved: 95,
  closed: 100,
};

function progressBarColor(status: BreakdownStatus): string {
  if (status === 'resolved' || status === 'closed') return 'bg-emerald-500';
  if (status === 'on_hold_parts' || status === 'on_hold_approval') return 'bg-orange-400';
  return 'bg-blue-500';
}

const SEVERITY_COLOR: Record<BreakdownSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

type Filter = 'all' | 'open' | 'critical' | 'closed';
type SeverityFilter = 'all' | 'high' | 'medium' | 'normal';

export default function BreakdownsPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId;

  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');
  const [informingId, setInformingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      orderBy('reportedAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBreakdowns(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Breakdown));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [siteId]);

  const filtered = useMemo(() => {
    const closedSet = new Set<BreakdownStatus>(['resolved', 'closed']);
    let list = breakdowns;
    if (filter === 'open') list = list.filter((b) => !closedSet.has(b.status));
    if (filter === 'critical') list = list.filter((b) => b.severity === 'critical');
    if (filter === 'closed') list = list.filter((b) => closedSet.has(b.status));
    if (severityFilter !== 'all') {
      const sevMatch = severityFilter === 'normal' ? 'low' : severityFilter;
      list = list.filter((b) => b.severity === sevMatch);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.ticketNumber?.toLowerCase().includes(s) ||
          b.machineName?.toLowerCase().includes(s) ||
          b.description?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [breakdowns, filter, severityFilter, search]);

  async function handleInform(breakdown: Breakdown) {
    if (!userProfile) return;
    setInformingId(breakdown.id);
    try {
      await updateDoc(doc(db, 'breakdown_tickets', breakdown.id), {
        statusHistory: arrayUnion({
          status: breakdown.status,
          changedBy: userProfile.id,
          changedByName: userProfile.fullName,
          changedAt: new Date().toISOString(),
          note: `Informed by ${userProfile.fullName}`,
        }),
        lastInformedBy: userProfile.id,
        lastInformedByName: userProfile.fullName,
        lastInformedAt: Timestamp.now(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to inform breakdown.');
    } finally {
      setInformingId(null);
    }
  }

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Breakdowns</h1>
            <p className="text-sm text-slate-500">{filtered.length} {filter === 'all' ? 'total' : filter}</p>
          </div>
          <Link
            to="/app/breakdowns/report"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Report Breakdown
          </Link>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            {(['open', 'critical', 'closed', 'all'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All</option>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket, machine, description…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
            <p className="text-5xl mb-3">🛠️</p>
            <p className="text-slate-500">No breakdowns matching this filter.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Ticket</th>
                  <th className="px-4 py-3 text-left">Machine</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Progress</th>
                  <th className="px-4 py-3 text-left">Reported By</th>
                  <th className="px-4 py-3 text-left">Reported</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((b) => (
                  <Fragment key={b.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-blue-600">
                      <button type="button" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)} className="hover:underline">
                        {b.ticketNumber || '—'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.machineName}</p>
                      <p className="text-slate-400 text-xs">{b.machineLocation}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${SEVERITY_COLOR[b.severity]}`}>
                        {b.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_COLOR[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressBarColor(b.status)}`}
                            style={{ width: `${STATUS_PROGRESS[b.status] ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums w-9 text-right">
                          {STATUS_PROGRESS[b.status] ?? 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{b.reporterName || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {b.reportedAt?.toDate ? b.reportedAt.toDate().toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleInform(b)}
                        disabled={informingId === b.id || ['resolved', 'closed'].includes(b.status)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Inform team about this breakdown"
                      >
                        <Bell className="w-3 h-3" />
                        {informingId === b.id ? 'Informing…' : 'Inform'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === b.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-6 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Progress timeline</p>
                        {(b.statusHistory ?? []).length === 0 ? (
                          <p className="text-sm text-slate-500">No status changes yet.</p>
                        ) : (
                          <ol className="space-y-1 text-sm">
                            {(b.statusHistory ?? []).map((h: any, idx: number) => (
                              <li key={idx} className="flex gap-3 items-center">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-white border border-slate-200">{STATUS_LABEL[h.status as BreakdownStatus] ?? h.status}</span>
                                <span className="text-slate-600">{h.changedByName}</span>
                                <span className="text-slate-400 text-xs">{h.changedAt?.toDate ? h.changedAt.toDate().toLocaleString() : (typeof h.changedAt === 'string' ? new Date(h.changedAt).toLocaleString() : '')}</span>
                                {h.note && <span className="text-slate-500 text-xs italic">— {h.note}</span>}
                              </li>
                            ))}
                          </ol>
                        )}
                        {b.linkedWOId && (
                          <p className="text-xs text-blue-600 mt-3">Linked WO: {b.linkedWOId}</p>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
