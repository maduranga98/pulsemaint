import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { FileDown, Loader2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useDepartments } from '@/hooks/useDepartments';
import { useDepartmentScope } from '@/hooks/useDepartmentScope';
import { sameDepartment, useRecordPlantMatcher } from '@/hooks/useRecordPlantMatcher';
import type { Breakdown } from '@/types/breakdown';
import type { WorkOrder, WOType } from '@/types/workOrder';
import { exportBreakdownPdf, exportWorkOrderPdf, fmtDateTime } from '@/utils/reports/pdf/maintenanceRecordPdf';

const field =
  'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';
const PAGE_SIZE = 50;
const WO_TYPES: WOType[] = ['BREAKDOWN', 'CORRECTIVE', 'PREVENTIVE', 'INSTALLATION', 'MODIFICATION', 'INSPECTION', 'CONTRACTOR', 'OTHER'];
const SIGNED_OFF: WorkOrder['status'][] = ['SIGNED_OFF', 'CLOSED'];

type Tab = 'workOrders' | 'breakdowns';

function millis(ts: { toMillis?: () => number } | null | undefined): number {
  return ts?.toMillis?.() ?? 0;
}
function woFinishedAt(wo: WorkOrder) {
  return wo.supervisorSignOffAt ?? wo.closedAt ?? wo.updatedAt;
}
function bdClosedBy(b: Breakdown): string {
  const entry = [...(b.statusHistory ?? [])].reverse().find((h) => h.status === 'closed');
  return entry?.changedByName ?? '';
}
function dayStart(v: string): number {
  return v ? new Date(`${v}T00:00:00`).getTime() : 0;
}
function dayEnd(v: string): number {
  return v ? new Date(`${v}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
}

/**
 * Plant manager's (and admin's) complete record of finished maintenance:
 * every signed-off / closed work order and every closed breakdown of their
 * plant — all time, every supervisor and department — with department /
 * supervisor / date filters and a full-detail PDF export per record.
 */
export default function MaintenanceHistoryPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const siteId = profile?.siteIds?.[0] || profile?.companyId;
  const { plantId } = useDepartmentScope();
  const { departments } = useDepartments(companyId, plantId);
  const inScopedPlant = useRecordPlantMatcher();

  const [tab, setTab] = useState<Tab>('workOrders');
  const [department, setDepartment] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [woType, setWoType] = useState<'' | WOType>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Work orders: signed off / closed, plant-scoped inside the hook.
  const { workOrders, loading: woLoading, error: woError } = useWorkOrders({ status: SIGNED_OFF });

  // Breakdowns: every closed ticket of the plant.
  const [allBreakdowns, setAllBreakdowns] = useState<Breakdown[]>([]);
  const [bdLoading, setBdLoading] = useState(true);
  const [bdError, setBdError] = useState<string | null>(null);
  useEffect(() => {
    if (!siteId) return;
    setBdLoading(true);
    return onSnapshot(
      query(collection(db, 'breakdown_tickets'), where('siteId', '==', siteId), orderBy('reportedAt', 'desc')),
      (snap) => {
        setAllBreakdowns(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Breakdown));
        setBdError(null);
        setBdLoading(false);
      },
      (err) => {
        setBdError(err.message);
        setBdLoading(false);
      },
    );
  }, [siteId]);
  const breakdowns = useMemo(
    () => allBreakdowns.filter((b) => b.status === 'closed' && inScopedPlant(b)),
    [allBreakdowns, inScopedPlant],
  );

  const woNumberById = useMemo(() => new Map(workOrders.map((w) => [w.id, w.woNumber])), [workOrders]);

  // Filter options — the plant's departments plus any found on old records.
  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    const add = (d: string | null | undefined) => {
      const v = (d ?? '').trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    };
    departments.forEach(add);
    workOrders.forEach((w) => add(w.machineDepartment));
    breakdowns.forEach((b) => add(b.machineDepartment));
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [departments, workOrders, breakdowns]);

  const supervisorOptions = useMemo(() => {
    const names = new Set<string>();
    if (tab === 'workOrders') {
      workOrders.forEach((w) => {
        if (w.supervisorInChargeName) names.add(w.supervisorInChargeName);
        if (w.supervisorSignOffByName) names.add(w.supervisorSignOffByName);
      });
    } else {
      breakdowns.forEach((b) => {
        if (b.assignedByName) names.add(b.assignedByName);
        const closer = bdClosedBy(b);
        if (closer) names.add(closer);
      });
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tab, workOrders, breakdowns]);

  // Filters other than department — department counts are computed on top.
  const woBase = useMemo(() => {
    const term = search.trim().toLowerCase();
    const lo = dayStart(from);
    const hi = dayEnd(to);
    return workOrders
      .filter((w) => {
        if (woType && w.woType !== woType) return false;
        if (supervisor && w.supervisorInChargeName !== supervisor && w.supervisorSignOffByName !== supervisor) return false;
        const at = millis(woFinishedAt(w));
        if (at < lo || at > hi) return false;
        if (!term) return true;
        return [w.woNumber, w.machineName, w.description, w.workDoneDescription ?? '', w.assignedTechnicianNames?.join(' ') ?? '']
          .some((v) => (v ?? '').toLowerCase().includes(term));
      })
      .sort((a, b) => millis(woFinishedAt(b)) - millis(woFinishedAt(a)));
  }, [workOrders, woType, supervisor, from, to, search]);

  const bdBase = useMemo(() => {
    const term = search.trim().toLowerCase();
    const lo = dayStart(from);
    const hi = dayEnd(to);
    return breakdowns
      .filter((b) => {
        if (supervisor && b.assignedByName !== supervisor && bdClosedBy(b) !== supervisor) return false;
        const at = millis(b.closedAt ?? b.updatedAt);
        if (at < lo || at > hi) return false;
        if (!term) return true;
        return [b.ticketNumber, b.machineName, b.description, b.rootCauseDescription ?? '', b.correctiveActions ?? '']
          .some((v) => (v ?? '').toLowerCase().includes(term));
      })
      .sort((a, b) => millis(b.closedAt ?? b.updatedAt) - millis(a.closedAt ?? a.updatedAt));
  }, [breakdowns, supervisor, from, to, search]);

  const base: (WorkOrder | Breakdown)[] = tab === 'workOrders' ? woBase : bdBase;

  const deptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    base.forEach((r) => {
      const key = departmentOptions.find((d) => sameDepartment(d, r.machineDepartment)) ?? '';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [base, departmentOptions]);

  const rows = useMemo(
    () => (department ? base.filter((r) => sameDepartment(r.machineDepartment, department)) : base),
    [base, department],
  );

  useEffect(() => setVisibleCount(PAGE_SIZE), [tab, department, supervisor, woType, from, to, search]);

  const loading = tab === 'workOrders' ? woLoading : bdLoading;
  const error = tab === 'workOrders' ? woError : bdError;

  async function exportPdf(id: string, run: () => Promise<void>) {
    setExportingId(id);
    try {
      await run();
    } catch (err) {
      console.error(err);
      toast.error(t('common.maintenanceHistory.exportFailed'));
    } finally {
      setExportingId(null);
    }
  }

  function clearFilters() {
    setDepartment('');
    setSupervisor('');
    setWoType('');
    setFrom('');
    setTo('');
    setSearch('');
  }

  const woTypeLabel = (type: string) => t(`common.maintenanceHistory.woTypes.${type}`, { defaultValue: type });

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-[#F0F4F8]">{t('common.maintenanceHistory.title')}</h1>
        <p className="text-sm text-[#8BA3BF]">{t('common.maintenanceHistory.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-[#1E3A5F]">
        {(['workOrders', 'breakdowns'] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setTab(k); setSupervisor(''); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k ? 'border-[#1A56DB] text-[#F0F4F8]' : 'border-transparent text-[#8BA3BF] hover:text-[#D5DEEA]'
            }`}
          >
            {t(`common.maintenanceHistory.tabs.${k}`)} ({k === 'workOrders' ? workOrders.length : breakdowns.length})
          </button>
        ))}
      </div>

      {/* Department summary — click to filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDepartment('')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!department ? 'bg-[#1A56DB] text-white' : 'bg-[#142849] text-[#B8C7DB] hover:bg-[#1E3A5F]'}`}
        >
          {t('common.maintenanceHistory.allDepartments')} ({base.length})
        </button>
        {departmentOptions.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDepartment(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              department === d ? 'bg-[#1A56DB] text-white' : 'bg-[#142849] text-[#B8C7DB] hover:bg-[#1E3A5F]'
            }`}
          >
            {d} ({deptCounts.get(d) ?? 0})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.maintenanceHistory.filters.search')}
          className={`${field} lg:col-span-2`}
        />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={field} aria-label={t('common.maintenanceHistory.filters.department')}>
          <option value="">{t('common.maintenanceHistory.allDepartments')}</option>
          {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className={field} aria-label={t('common.maintenanceHistory.filters.supervisor')}>
          <option value="">{t('common.maintenanceHistory.filters.allSupervisors')}</option>
          {supervisorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-[#8BA3BF]">
          <span className="shrink-0">{t('common.maintenanceHistory.filters.from')}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className="flex items-center gap-2 text-xs text-[#8BA3BF]">
          <span className="shrink-0">{t('common.maintenanceHistory.filters.to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        {tab === 'workOrders' && (
          <select value={woType} onChange={(e) => setWoType(e.target.value as '' | WOType)} className={field} aria-label={t('common.maintenanceHistory.filters.woType')}>
            <option value="">{t('common.maintenanceHistory.filters.allTypes')}</option>
            {WO_TYPES.map((type) => <option key={type} value={type}>{woTypeLabel(type)}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-lg border border-[#1E3A5F] px-3 py-2 text-sm text-[#B8C7DB] hover:border-[#2E5A8F]"
        >
          {t('common.maintenanceHistory.filters.clear')}
        </button>
      </div>

      {error && <p className="text-sm text-[#F87171]">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1A56DB] border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#1E3A5F] px-4 py-10 text-center text-sm text-[#8BA3BF]">
          {t('common.maintenanceHistory.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1E3A5F]">
          <table className="min-w-full text-sm">
            <thead>
              {tab === 'workOrders' ? (
                <tr className="text-left text-xs uppercase tracking-wide">
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.wo')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.machine')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.department')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.supervisor')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.signedOff')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.outcome')}</th>
                  <th className="px-3 py-2 text-right">{t('common.maintenanceHistory.columns.actions')}</th>
                </tr>
              ) : (
                <tr className="text-left text-xs uppercase tracking-wide">
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.ticket')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.machine')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.department')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.rootCause')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.closed')}</th>
                  <th className="px-3 py-2">{t('common.maintenanceHistory.columns.attendedBy')}</th>
                  <th className="px-3 py-2 text-right">{t('common.maintenanceHistory.columns.actions')}</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {rows.slice(0, visibleCount).map((r) => {
                const busy = exportingId === r.id;
                if (tab === 'workOrders') {
                  const w = r as WorkOrder;
                  return (
                    <tr key={w.id} className="align-top text-[#D5DEEA]">
                      <td className="px-3 py-2">
                        <div className="font-medium text-[#F0F4F8]">{w.woNumber}</div>
                        <div className="text-xs text-[#8BA3BF]">{woTypeLabel(w.woType)}</div>
                      </td>
                      <td className="px-3 py-2">{w.machineName || '—'}</td>
                      <td className="px-3 py-2">{w.machineDepartment || '—'}</td>
                      <td className="px-3 py-2">{w.supervisorInChargeName || '—'}</td>
                      <td className="px-3 py-2">
                        <div>{w.supervisorSignOffByName || w.closedByName || '—'}</div>
                        <div className="text-xs text-[#8BA3BF]">{fmtDateTime(woFinishedAt(w))}</div>
                      </td>
                      <td className="px-3 py-2">
                        {w.signOffOutcome ? t(`common.maintenanceHistory.outcomes.${w.signOffOutcome}`) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <RowActions
                          busy={busy}
                          viewTo={`/app/work-orders?woId=${w.id}`}
                          onExport={() => void exportPdf(w.id, () => exportWorkOrderPdf(w))}
                        />
                      </td>
                    </tr>
                  );
                }
                const b = r as Breakdown;
                return (
                  <tr key={b.id} className="align-top text-[#D5DEEA]">
                    <td className="px-3 py-2">
                      <div className="font-medium text-[#F0F4F8]">{b.ticketNumber}</div>
                      <div className="text-xs capitalize text-[#8BA3BF]">{b.severity ?? ''}</div>
                    </td>
                    <td className="px-3 py-2">{b.machineName || '—'}</td>
                    <td className="px-3 py-2">{b.machineDepartment || '—'}</td>
                    <td className="px-3 py-2">
                      {b.rootCause ? t(`common.maintenanceHistory.rootCauses.${b.rootCause}`, { defaultValue: b.rootCause }) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div>{bdClosedBy(b) || '—'}</div>
                      <div className="text-xs text-[#8BA3BF]">{fmtDateTime(b.closedAt)}</div>
                    </td>
                    <td className="px-3 py-2">{b.attendedByName || b.assignedTechnicianNames?.join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      <RowActions
                        busy={busy}
                        viewTo={`/app/breakdowns/${b.id}`}
                        onExport={() =>
                          void exportPdf(b.id, () =>
                            exportBreakdownPdf(b, { linkedWoNumber: b.linkedWOId ? woNumberById.get(b.linkedWOId) ?? null : null }),
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > visibleCount && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm text-[#B8C7DB] hover:border-[#2E5A8F]"
          >
            {t('common.maintenanceHistory.showMore', { shown: visibleCount, total: rows.length })}
          </button>
        </div>
      )}
    </div>
  );
}

function RowActions({ busy, viewTo, onExport }: { busy: boolean; viewTo: string; onExport: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-2">
      <Link
        to={viewTo}
        className="inline-flex items-center gap-1 rounded-lg border border-[#1E3A5F] px-2.5 py-1.5 text-xs text-[#B8C7DB] hover:border-[#2E5A8F]"
      >
        <ExternalLink className="h-3.5 w-3.5" /> {t('common.maintenanceHistory.view')}
      </Link>
      <button
        type="button"
        onClick={onExport}
        disabled={busy}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-[#1A56DB] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E4FC2] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        {t('common.maintenanceHistory.exportPdf')}
      </button>
    </div>
  );
}
