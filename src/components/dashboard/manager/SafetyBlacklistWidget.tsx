import { useMemo } from 'react';
import { Ban } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useSafetyBlacklist } from '@/hooks/safety/useSafety';
import { BLACKLIST_THRESHOLD, type BlacklistEntityType } from '@/lib/safety/blacklist';

const ENTITY_LABEL: Record<BlacklistEntityType, string> = {
  technician: 'Technician',
  contractor: 'Contractor',
  operator: 'Operator',
  machine: 'Machine',
};

/** Admin/Plant Manager Analytics → Safety tab: who/what is currently blacklisted from WO assignment. */
export default function SafetyBlacklistWidget({ companyId }: { companyId: string }) {
  const { entries, loading } = useSafetyBlacklist(companyId);
  const blacklisted = useMemo(() => entries.filter((e) => e.isBlacklisted), [entries]);

  return (
    <DashboardWidget title={`Blacklisted (${BLACKLIST_THRESHOLD}+ safety-case points)`} loading={loading}>
      {blacklisted.length === 0 ? (
        <EmptyState message="No one is currently blacklisted" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Points</th>
                <th className="py-2 pr-3 font-medium">Cases</th>
              </tr>
            </thead>
            <tbody>
              {blacklisted.map((e) => (
                <tr key={`${e.entityType}:${e.entityId}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-gray-800">{e.entityName}</td>
                  <td className="py-2.5 pr-3 text-gray-600">{ENTITY_LABEL[e.entityType]}</td>
                  <td className="py-2.5 pr-3 font-semibold text-red-600">
                    <span className="inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" /> {e.points}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-600">{e.caseCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
