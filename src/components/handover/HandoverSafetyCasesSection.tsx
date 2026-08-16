import { useAuthStore } from '@/store/authStore';
import { useSafetyCases } from '@/hooks/safety/useSafety';

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'text-red-700',
  high: 'text-amber-700',
  medium: 'text-amber-600',
  low: 'text-slate-600',
};

// Safety cases currently reported to the logged-in user (escalated to them,
// or naming them as the subject), excluding closed ones — so the incoming/
// outgoing supervisor sees what's actually still open on their plate.
export function HandoverSafetyCasesSection() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { cases, loading } = useSafetyCases(companyId);

  const mine = cases.filter(
    (c) =>
      c.status !== 'closed' &&
      (c.reportedToUserId === userProfile?.id || c.subjectId === userProfile?.id),
  );

  return (
    <section className="space-y-3">
      <h2 className="font-[Sora] font-bold text-slate-950">Safety Cases Reported to You</h2>
      {loading ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">Loading safety cases...</p>
      ) : mine.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No open safety cases reported to you.</p>
      ) : (
        mine.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-950">{c.title || c.type}</p>
              <span className={`text-xs font-semibold uppercase ${SEVERITY_CLASS[c.severity] ?? 'text-slate-600'}`}>{c.severity}</span>
            </div>
            <p className="text-sm text-slate-600 capitalize">{c.type.replace(/_/g, ' ')} · {c.status}</p>
            {c.actionToTake && <p className="mt-1 text-sm text-slate-800">{c.actionToTake}</p>}
          </div>
        ))
      )}
    </section>
  );
}

export default HandoverSafetyCasesSection;
