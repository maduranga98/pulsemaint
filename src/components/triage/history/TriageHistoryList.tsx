import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTriageHistory, type TriageHistoryFilters } from '../../../hooks/triage/useTriageHistory';
import type { TriageSessionStatus, TriageOutcomeType } from '../../../types/triage';
import TriageHistoryCard from './TriageHistoryCard';

export default function TriageHistoryList() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<TriageHistoryFilters>({});
  const { sessions, loading } = useTriageHistory(filters);

  const updateFilter = (patch: Partial<TriageHistoryFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const statuses: TriageSessionStatus[] = ['in_progress', 'completed', 'escalated', 'quick_fix', 'abandoned'];
  const outcomes: TriageOutcomeType[] = [
    'resolved_by_operator', 'repair_team_required', 'machine_shutdown', 'emergency_escalated', 'abandoned',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#0A1628] font-['Sora'] mb-5">Triage History</h1>

      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filters.status ?? ''}
          onChange={(e) => updateFilter({ status: (e.target.value as TriageSessionStatus) || undefined })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
        >
          <option value="">{t('triage.all_statuses')}</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select
          value={filters.outcomeType ?? ''}
          onChange={(e) => updateFilter({ outcomeType: (e.target.value as TriageOutcomeType) || undefined })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
        >
          <option value="">{t('triage.all_outcomes')}</option>
          {outcomes.map((o) => <option key={o} value={o}>{t(`triage.outcome.${o}`)}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">{t('triage.loading')}</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500">{t('triage.no_sessions')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map((s) => <TriageHistoryCard key={s.id} session={s} />)}
        </div>
      )}
    </div>
  );
}
