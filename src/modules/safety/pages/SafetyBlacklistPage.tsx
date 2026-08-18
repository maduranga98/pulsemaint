import { useMemo, useState } from 'react';
import { ShieldOff, Ban } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { useSafetyBlacklist } from '@/hooks/safety/useSafety';
import { clearSafetyBlacklistEntry } from '@/services/safety.service';
import { BLACKLIST_THRESHOLD, type BlacklistEntityType } from '@/lib/safety/blacklist';

const TYPE_LABEL: Record<BlacklistEntityType, string> = {
  technician: 'Technician',
  contractor: 'Contractor',
  operator: 'Operator',
  machine: 'Machine',
};

const TYPE_FILTER_OPTIONS: { value: BlacklistEntityType | ''; label: string }[] = [
  { value: '', label: 'All roles/types' },
  { value: 'technician', label: 'Technician' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'operator', label: 'Operator' },
  { value: 'machine', label: 'Machine' },
];

const field = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500';

function fmtDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function SafetyBlacklistPage() {
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const { entries, loading } = useSafetyBlacklist(companyId);
  const { success: toastSuccess, error: toastError } = useToast();

  const [typeFilter, setTypeFilter] = useState<BlacklistEntityType | ''>('');
  const [onlyBlacklisted, setOnlyBlacklisted] = useState(true);
  const [minPoints, setMinPoints] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clearingKey, setClearingKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    const min = minPoints ? Number(minPoints) : null;
    return entries.filter((e) => {
      if (onlyBlacklisted && !e.isBlacklisted) return false;
      if (typeFilter && e.entityType !== typeFilter) return false;
      if (min !== null && e.points < min) return false;
      if (fromMs !== null && (e.lastCaseAt ?? 0) < fromMs) return false;
      if (toMs !== null && (e.lastCaseAt ?? 0) > toMs) return false;
      return true;
    });
  }, [entries, onlyBlacklisted, typeFilter, minPoints, dateFrom, dateTo]);

  const blacklistedCount = entries.filter((e) => e.isBlacklisted).length;

  async function handleClear(entityType: BlacklistEntityType, entityId: string, entityName: string) {
    if (!profile) return;
    const key = `${entityType}:${entityId}`;
    if (!window.confirm(`Clear ${entityName}'s safety points back to 0? This removes their blacklist until new safety cases accrue points again.`)) {
      return;
    }
    setClearingKey(key);
    try {
      await clearSafetyBlacklistEntry({
        companyId,
        entityType,
        entityId,
        entityName,
        clearedBy: profile.id,
        clearedByName: profile.fullName ?? profile.email ?? 'Admin',
      });
      toastSuccess('Points cleared.');
    } catch (err) {
      console.error('Failed to clear safety blacklist entry', err);
      toastError('Failed to clear. Please try again.');
    } finally {
      setClearingKey(null);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-6 w-6 text-red-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Safety Blacklist</h1>
            <p className="text-sm text-slate-500">
              Technicians, contractors, operators, and machines that reached {BLACKLIST_THRESHOLD}+ safety-case points are
              automatically blocked from new work order assignment.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-center">
          <div className="text-2xl font-bold text-red-700">{blacklistedCount}</div>
          <div className="text-xs text-red-600">Currently blacklisted</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as BlacklistEntityType | '')} className={field}>
          {TYPE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          placeholder="Min points"
          value={minPoints}
          onChange={(e) => setMinPoints(e.target.value)}
          className={`${field} w-32`}
        />
        <label className="text-xs text-slate-500">From</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={field} />
        <label className="text-xs text-slate-500">To</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={field} />
        <label className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={onlyBlacklisted} onChange={(e) => setOnlyBlacklisted(e.target.checked)} />
          Blacklisted only
        </label>
      </div>

      <DashboardWidget title="Points by entity" loading={loading}>
        {filtered.length === 0 ? (
          <EmptyState message="No entities match the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Points</th>
                  <th className="py-2 pr-3 font-medium">Cases</th>
                  <th className="py-2 pr-3 font-medium">Last case</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const key = `${e.entityType}:${e.entityId}`;
                  return (
                    <tr key={key} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{e.entityName}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{TYPE_LABEL[e.entityType]}</td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">{e.points}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{e.caseCount}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{fmtDate(e.lastCaseAt)}</td>
                      <td className="py-2.5 pr-3">
                        {e.isBlacklisted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            <Ban className="h-3 w-3" /> Blacklisted
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">OK</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <button
                          type="button"
                          disabled={clearingKey === key || e.points === 0}
                          onClick={() => handleClear(e.entityType, e.entityId, e.entityName)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          Clear to 0
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardWidget>
    </div>
  );
}
