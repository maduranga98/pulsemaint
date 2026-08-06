import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useSafetyCases } from '../../../hooks/safety/useSafety';

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-500/15 text-amber-300',
  investigating: 'bg-blue-500/15 text-blue-300',
  closed: 'bg-emerald-500/15 text-emerald-300',
};

// Safety cases escalated to me for action (reportedToUserId === me) — the
// same set the "Safety Cases Reported to Me" page showed, now surfaced on
// the dashboard instead of a dedicated nav tab.
export default function MySafetyCasesWidget() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { cases, loading } = useSafetyCases(companyId);

  const mine = cases.filter((c) => c.reportedToUserId === userProfile?.id && c.status !== 'closed');

  return (
    <DashboardWidget title="Safety Cases" loading={loading}>
      {mine.length === 0 ? (
        <EmptyState message="No safety cases assigned to you" />
      ) : (
        <div className="space-y-2">
          {mine.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{c.title || c.type}</p>
                <p className="text-[11px] text-[#8BA3BF]">{c.type}</p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_COLOR[c.status] ?? 'bg-[#1E3A5F] text-[#8BA3BF]'}`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
