import { useMemo, useState } from 'react';
import { funnel, groupStats, revenueText, staleLeads, type GroupStats, type Lead, type TeamMember } from '@/lib/platform/leads';
import { Card, fmtDate } from '../platformUi';
import { StatusPill } from './leadUi';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/** Which outside channels, campaigns and people actually produce customers. */
export default function LeadInsights({ leads, team, onOpenLead }: { leads: Lead[]; team: TeamMember[]; onOpenLead: (id: string) => void }) {
  const [staleDays, setStaleDays] = useState(7);
  const name = (id: string | null) => (id ? team.find((m) => m.id === id)?.name ?? 'Removed member' : 'Lumora (direct)');
  const steps = useMemo(() => funnel(leads), [leads]);
  const bySource = useMemo(() => groupStats(leads, (l) => l.source), [leads]);
  const byCampaign = useMemo(() => groupStats(leads, (l) => l.campaign).filter((g) => g.key !== '—'), [leads]);
  const byMarketer = useMemo(() => groupStats(leads, (l) => l.marketerId ?? ''), [leads]);
  const byDistrict = useMemo(() => groupStats(leads, (l) => l.district).slice(0, 10), [leads]);
  const cold = useMemo(() => staleLeads(leads, staleDays), [leads, staleDays]);
  const top = steps[0]?.count || 1;

  return (
    <div className="space-y-5">
      <Card title="Pipeline funnel">
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={s.stage} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-slate-300">{s.stage}</span>
              <div className="h-6 flex-1 rounded bg-[#0A1628]">
                <div className="flex h-6 items-center rounded bg-blue-600/70 px-2 text-xs font-semibold text-white" style={{ width: `${Math.max(4, (s.count / top) * 100)}%` }}>{s.count}</div>
              </div>
              <span className="w-14 text-right text-xs text-slate-500">{i === 0 ? '' : pct(steps[i - 1].count ? s.count / steps[i - 1].count : 0)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Right column: share that made it from the previous step.</p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <GroupTable title="By source" rows={bySource} label={(k) => k} />
        <GroupTable title="By outside marketer / agent" rows={byMarketer} label={(k) => name(k === '—' ? null : k)} />
        <GroupTable title="By campaign" rows={byCampaign} label={(k) => k} empty="Set a campaign on leads (or on import) to compare ads." />
        <GroupTable title="Top districts" rows={byDistrict} label={(k) => k} />
      </div>

      <Card
        title={`Going cold (${cold.length})`}
        actions={
          <select className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-2 py-1 text-xs text-slate-200" value={staleDays} onChange={(e) => setStaleDays(Number(e.target.value))}>
            {[3, 7, 14, 30].map((d) => <option key={d} value={d}>No contact for {d}+ days</option>)}
          </select>
        }
      >
        <p className="mb-3 text-xs text-slate-500">Open leads with no call booked and nothing logged recently. Book a call or close them out.</p>
        {cold.length === 0 ? <p className="text-sm text-slate-400">Nothing going cold. 🎉</p> : (
          <ul className="divide-y divide-[#1E3A5F]">
            {cold.slice(0, 50).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <button className="text-left font-medium text-white hover:underline" onClick={() => onOpenLead(l.id)}>{l.businessName}</button>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {name(l.assignedTo) !== 'Lumora (direct)' && <span>{name(l.assignedTo)}</span>}
                  Last touched {fmtDate(l.lastActivityAt ?? l.createdAt ?? l.leadDate)} <StatusPill status={l.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function GroupTable({ title, rows, label, empty }: { title: string; rows: GroupStats[]; label: (k: string) => string; empty?: string }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <p className="text-sm text-slate-400">{empty ?? 'No data yet.'}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr><th className="py-1.5 pr-2"></th><th className="px-2 text-right">Leads</th><th className="px-2 text-right">Open</th><th className="px-2 text-right">Demos</th><th className="px-2 text-right">Won</th><th className="px-2 text-right">Win rate</th><th className="pl-2 text-right">Revenue</th></tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.key} className="border-t border-[#1E3A5F]">
                  <td className="max-w-[180px] truncate py-1.5 pr-2 text-white" title={label(g.key)}>{label(g.key)}</td>
                  <td className="px-2 text-right">{g.leads}</td>
                  <td className="px-2 text-right text-slate-400">{g.open}</td>
                  <td className="px-2 text-right text-violet-300">{g.demos}</td>
                  <td className="px-2 text-right text-emerald-300">{g.won}</td>
                  <td className="px-2 text-right">{pct(g.winRate)}</td>
                  <td className="pl-2 text-right text-xs text-slate-300">{revenueText(g.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
