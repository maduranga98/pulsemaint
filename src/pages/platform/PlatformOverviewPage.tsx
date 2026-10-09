import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformService, errorText, type PlatformOverview } from '@/services/platformService';
import { Card, ErrorNote, Loading, PageHeader, PLAN_NAMES, Stat, fmtDateTime } from './platformUi';

export default function PlatformOverviewPage() {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof platformService.auditLog>>['entries']>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    platformService.overview().then(setData).catch((e) => setError(errorText(e, 'Could not load the overview')));
    platformService.auditLog().then((r) => setAudit(r.entries.slice(0, 12))).catch(() => {});
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;
  const t = data.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Every FirmiCore company, subscription and follow-up at a glance." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(t.pendingApproval ?? 0) > 0 && (
          <Link to="/platform/companies?approval=pending" className="block">
            <Stat label="Waiting for approval" value={t.pendingApproval} hint="New registrations — review now →" tone="amber" />
          </Link>
        )}
        <Stat label="Companies" value={t.companies} hint={`${t.active} active · ${t.trial} trial · ${t.suspended} suspended`} />
        <Stat label="Est. monthly revenue" value={`$${t.mrr.toLocaleString()}`} hint="Active subscriptions (yearly ÷ 12)" tone="green" />
        <Stat label="Monthly subscriptions" value={t.monthly} />
        <Stat label="Yearly subscriptions" value={t.yearly} />
        <Stat label="Payment problems" value={t.pastDue} hint="Past due or unpaid" tone={t.pastDue ? 'red' : undefined} />
        <Stat label="Renewals in 7 days" value={t.renewalsSoon} />
        <Stat label="Trials ending in 7 days" value={t.trialsEndingSoon} tone={t.trialsEndingSoon ? 'amber' : undefined} />
        <Stat label="Open requests" value={t.openRequests} hint={`${t.cancelling} subscription(s) cancelling`} tone={t.openRequests ? 'amber' : undefined} />
        <Stat label="Average feedback rating" value={t.ratingAverage != null ? `${t.ratingAverage} ★` : '—'} hint={`${t.ratingCount ?? 0} rating(s)`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Paid subscriptions by plan">
          {Object.keys(data.byPlan).length === 0 ? (
            <p className="text-sm text-slate-400">No paid subscriptions yet.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(data.byPlan).map(([plan, count]) => (
                <li key={plan} className="flex justify-between text-sm"><span>{PLAN_NAMES[plan] ?? plan}</span><span className="font-semibold text-white">{count}</span></li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link to="/platform/reminders" className="text-blue-300! hover:underline">Payment follow-ups →</Link>
            <Link to="/platform/requests" className="text-blue-300! hover:underline">Requests & feedback →</Link>
          </div>
        </Card>
        <Card title="Recent superadmin activity">
          {audit.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2">
                  <span><span className="text-white">{a.action}</span>{a.companyName && <> · {a.companyName}</>}</span>
                  <span className="text-xs text-slate-500">{a.actorEmail} · {fmtDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
