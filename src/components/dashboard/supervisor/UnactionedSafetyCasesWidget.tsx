import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useSafetyCases } from '../../../hooks/safety/useSafety';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

// Safety cases escalated to this supervisor that nobody has acted on yet —
// replaces the standalone "Safety Cases" nav tab supervisors used to have.
export default function UnactionedSafetyCasesWidget() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { cases, loading } = useSafetyCases(companyId);

  const unactioned = cases.filter(
    (c) =>
      c.status !== 'closed' &&
      c.reportedToUserId === userProfile?.id &&
      (c.actions ?? []).length === 0,
  );

  return (
    <DashboardWidget title={`Safety Cases Reported (${unactioned.length})`} loading={loading}>
      {unactioned.length === 0 ? (
        <EmptyState message="No unactioned safety cases" />
      ) : (
        <div className="space-y-2">
          {unactioned.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate('/app/safety/cases')}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#1A56DB] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{c.title || c.type}</p>
                <p className="text-[11px] text-[#8BA3BF]">{c.type.replace('_', ' ')}</p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[c.severity] ?? 'bg-slate-500 text-white'}`}>
                {c.severity}
              </span>
            </button>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
