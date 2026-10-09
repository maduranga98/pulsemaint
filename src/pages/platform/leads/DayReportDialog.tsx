import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Download, FileText, PhoneCall, StickyNote, Users, Sparkles, UserPlus, Wallet } from 'lucide-react';
import {
  activityOutcomeLabel, activityTypeLabel, dayReport, dayReportToCsv, endOfDay, revenueText, startOfDay,
  type Lead, type LeadActivity,
} from '@/lib/platform/leads';
import { getActivitiesBetween } from '@/services/platformLeadsService';
import { ErrorNote, Loading, btn, input } from '../platformUi';
import { Modal, StatusPill, downloadText, fromDateInput, toDateInput } from './leadUi';

/** What the team did on one day — calls, notes, demos, new leads, wins — with CSV export. */
export default function DayReportDialog({ leads, onClose, onOpenLead }: { leads: Lead[]; onClose: () => void; onOpenLead: (id: string) => void }) {
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [acts, setActs] = useState<LeadActivity[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setActs(null);
    setError('');
    getActivitiesBetween(startOfDay(day), endOfDay(day)).then(setActs).catch((e) => setError(e.message));
  }, [day]);

  const report = useMemo(() => (acts ? dayReport(day, acts, leads) : null), [acts, day, leads]);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const dateLabel = new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Modal
      wide
      title={<><FileText className="h-4 w-4 text-amber-300" /> Day report</>}
      onClose={onClose}
      footer={<>
        <span className="mr-auto text-xs text-slate-500">{dateLabel}</span>
        <button className={btn.ghost} onClick={onClose}>Close</button>
        <button className={`${btn.primary} inline-flex items-center gap-1.5`} disabled={!report} onClick={() => report && downloadText(`day-report-${toDateInput(day)}.csv`, dayReportToCsv(report, leads))}>
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="date" className={`${input} w-auto!`} value={toDateInput(day)} onChange={(e) => setDay(fromDateInput(e.target.value) ?? startOfDay(Date.now()))} />
        <button className={btn.ghost} onClick={() => setDay(startOfDay(Date.now()))}>Today</button>
        <button className={btn.ghost} onClick={() => setDay(startOfDay(day - 86_400_000))}>← Previous</button>
        <button className={btn.ghost} onClick={() => setDay(startOfDay(day + 86_400_000 + 3_600_000))}>Next →</button>
      </div>
      {error && <ErrorNote message={error} />}
      {!report && !error ? <Loading /> : report && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Mini icon={PhoneCall} label="Calls made" value={report.calls} tone="text-sky-300" />
            <Mini icon={StickyNote} label="Notes logged" value={report.notes} tone="text-slate-300" />
            <Mini icon={Users} label="Customers touched" value={report.customers} tone="text-orange-300" />
            <Mini icon={Sparkles} label="Demos booked" value={report.demosBooked} tone="text-violet-300" />
            <Mini icon={UserPlus} label="New leads" value={report.newLeads} tone="text-cyan-300" />
            <Mini icon={Wallet} label={`Won (${revenueText(report.wonAmount)})`} value={report.won} tone="text-emerald-300" />
          </div>
          {Object.keys(report.outcomes).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(report.outcomes).map(([k, v]) => <span key={k} className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">{k} <b className="text-white">{v}</b></span>)}
            </div>
          )}
          <div className="mt-4 overflow-x-auto rounded-lg border border-[#1E3A5F]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#0A1628] text-xs text-slate-400">
                <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Outcome</th><th className="px-3 py-2">Note</th><th className="px-3 py-2">Status now</th></tr>
              </thead>
              <tbody>
                {report.rows.map((a) => {
                  const l = byId.get(a.leadId);
                  return (
                    <tr key={a.id} className="border-t border-[#1E3A5F] align-top">
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{new Date(a.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-2">
                        <button className="text-left font-semibold text-white hover:underline" onClick={() => l && onOpenLead(l.id)}>{l?.businessName ?? a.leadName}</button>
                        {l?.phone && <p className="font-mono text-xs text-slate-500">{l.phone}</p>}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{activityTypeLabel(a)}</td>
                      <td className="px-3 py-2 text-slate-300">{activityOutcomeLabel(a)}</td>
                      <td className="max-w-sm whitespace-pre-wrap px-3 py-2 text-slate-200">{a.body || '—'}</td>
                      <td className="px-3 py-2">{l ? <StatusPill status={l.status} /> : <span className="text-xs text-slate-500">deleted</span>}</td>
                    </tr>
                  );
                })}
                {report.rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Nothing logged on this day.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function Mini({ icon: Icon, label, value, tone }: { icon: typeof CalendarCheck; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
      <Icon className={`h-5 w-5 ${tone}`} />
      <div className="min-w-0"><p className="text-lg font-bold text-white">{value}</p><p className="truncate text-xs text-slate-400" title={label}>{label}</p></div>
    </div>
  );
}
