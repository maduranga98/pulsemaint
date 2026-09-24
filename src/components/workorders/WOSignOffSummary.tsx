import { useTranslation } from 'react-i18next';
import { FileText, Paperclip } from 'lucide-react';
import type { WorkOrder } from '../../types/workOrder';
import type { WorkPermit } from '../../types/safety';
import { WOAiRcaCard } from './WOAiRcaCard';

interface Props {
  workOrder: WorkOrder;
  permits: WorkPermit[];
  /** Supervisors/managers/admins can (re)run the AI root-cause analysis. */
  canRegenerateRca: boolean;
}

type Ts = { toDate?: () => Date } | null | undefined;
const fmt = (ts: Ts) => (ts?.toDate ? ts.toDate().toLocaleString() : '—');
const mins = (m: number | null | undefined) => {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-[#60A5FA] uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  );
}

/**
 * One consolidated record of a signed-off work order: outcome and who signed
 * it off, timings, what each assigned person did (with their own start and
 * completion times), tasks with measurements, parts, work permits, approval
 * requests, root cause (technician's and AI's) and every attached document.
 */
export function WOSignOffSummary({ workOrder: wo, permits, canRegenerateRca }: Props) {
  const { t } = useTranslation();
  const d = (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
    t(`common.workOrders.summary.${key}`, { defaultValue, ...opts });

  const people = wo.assignedTechnicianIds.map((id, i) => {
    const state = (wo.assigneeStates ?? []).find((s) => s.technicianId === id);
    const done = (wo.assigneeCompletions ?? []).find((c) => c.technicianId === id);
    const log = (wo.technicianWorkLogs ?? []).find((l) => l.technicianId === id);
    const tasks = (wo.checklist ?? []).filter((c) => c.completedBy === id).map((c) => c.stepDescription);
    return {
      id,
      name: done?.technicianName ?? state?.technicianName ?? wo.assignedTechnicianNames[i] ?? id,
      role: done?.technicianRole ?? log?.technicianRole,
      startedAt: state?.startedAt ?? wo.actualStartTime,
      completedAt: done?.completedAt ?? null,
      hours: done?.hoursWorked ?? log?.hoursWorked,
      work: done?.workDoneDescription || log?.tasksDescription || '',
      tasks,
    };
  });

  const docs = [
    ...(wo.documents ?? []).map((doc) => ({ name: doc.name, url: doc.url, by: doc.uploadedByName })),
    ...(wo.finalPhotos ?? []).map((url, i) => ({ name: d('finalPhoto', 'Final photo {{n}}', { n: i + 1 }), url, by: '' })),
    ...(wo.approvalRequests ?? []).flatMap((a) =>
      [...(a.attachments ?? []), ...(a.resolutionAttachments ?? [])].map((f) => ({ name: f.name, url: f.url, by: a.technicianName }))),
  ];
  const partsCost = (wo.partsUsed ?? []).reduce((s, p) => s + (p.totalCost || 0), 0);
  return (
    <div className="rounded-xl border border-[#1E3A5F] bg-[#0A1628] p-4 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-[#F0F4F8]">{d('title', 'Sign-off summary')}</h3>
        {wo.signOffOutcome && (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
            wo.signOffOutcome === 'complete' ? 'bg-emerald-600 text-white' : wo.signOffOutcome === 'failed' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
          }`}>
            {d(`outcome.${wo.signOffOutcome}`, wo.signOffOutcome.replace('_', ' '))}
          </span>
        )}
      </div>

      {/* Sign-off + timings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><p className="text-xs text-[#8BA3BF]">{d('signedOffBy', 'Signed off by')}</p><p className="font-medium text-[#F0F4F8]">{wo.supervisorSignOffByName || wo.closedByName || '—'}</p></div>
        <div><p className="text-xs text-[#8BA3BF]">{d('signedOffAt', 'Signed off at')}</p><p className="font-medium text-[#F0F4F8]">{fmt(wo.supervisorSignOffAt ?? wo.closedAt)}</p></div>
        <div><p className="text-xs text-[#8BA3BF]">{d('started', 'Work started')}</p><p className="font-medium text-[#F0F4F8]">{fmt(wo.actualStartTime)}</p></div>
        <div><p className="text-xs text-[#8BA3BF]">{d('completed', 'Work completed')}</p><p className="font-medium text-[#F0F4F8]">{fmt(wo.actualEndTime)}</p></div>
        <div><p className="text-xs text-[#8BA3BF]">{d('duration', 'Time used')}</p><p className="font-medium text-[#F0F4F8]">{mins(wo.totalDurationMinutes)}</p></div>
        <div><p className="text-xs text-[#8BA3BF]">{d('created', 'Raised')}</p><p className="font-medium text-[#F0F4F8]">{fmt(wo.createdAt)}</p></div>
        {wo.testRunResult && <div><p className="text-xs text-[#8BA3BF]">{d('testRun', 'Test run')}</p><p className="font-medium text-[#F0F4F8]">{wo.testRunResult}</p></div>}
        {wo.machineStatusAfterRepair && <div><p className="text-xs text-[#8BA3BF]">{d('machineAfter', 'Machine after repair')}</p><p className="font-medium text-[#F0F4F8]">{wo.machineStatusAfterRepair.replace(/_/g, ' ')}</p></div>}
      </div>
      {(wo.signOffOutcomeReason || wo.supervisorSignOffNotes) && (
        <p className="text-sm text-[#D5DEEA]">
          {wo.signOffOutcomeReason && <span className="block">{d('reason', 'Reason')}: {wo.signOffOutcomeReason}</span>}
          {wo.supervisorSignOffNotes && <span className="block italic">"{wo.supervisorSignOffNotes}"</span>}
        </p>
      )}

      {wo.workDoneDescription && (
        <Section title={d('whatWasDone', 'What was done')}>
          <p className="text-sm text-[#F0F4F8] whitespace-pre-line">{wo.workDoneDescription}</p>
        </Section>
      )}

      {people.length > 0 && (
        <Section title={d('team', 'Assigned people')}>
          <div className="space-y-2">
            {people.map((p) => (
              <div key={p.id} className="rounded-lg bg-[#0F1E35] border border-[#1E3A5F] p-3 text-sm">
                <p className="font-medium text-[#F0F4F8]">{p.name}{p.role ? <span className="text-[#8BA3BF] font-normal"> · {p.role.replace(/_/g, ' ')}</span> : null}</p>
                <p className="text-xs text-[#8BA3BF]">
                  {d('personTimes', 'Started {{start}} · Completed {{end}} · {{hours}}h', { start: fmt(p.startedAt), end: fmt(p.completedAt), hours: p.hours ?? '—' })}
                </p>
                {p.work && <p className="mt-1 text-[#D5DEEA] whitespace-pre-line">{p.work}</p>}
                {p.tasks.length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-[#B6C4D6] text-xs">{p.tasks.map((task, i) => <li key={i}>{task}</li>)}</ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(wo.checklist ?? []).length > 0 && (
        <Section title={d('tasks', 'Tasks & measurements')}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[#8BA3BF] text-left">
                <tr><th className="py-1 pr-2">#</th><th className="py-1 pr-2">{d('task', 'Task')}</th><th className="py-1 pr-2">{d('measurement', 'Measurement')}</th><th className="py-1 pr-2">{d('doneBy', 'Done by / at')}</th></tr>
              </thead>
              <tbody className="text-[#F0F4F8]">
                {wo.checklist.map((c) => (
                  <tr key={c.stepNumber} className="border-t border-[#1E3A5F] align-top">
                    <td className="py-1 pr-2">{c.stepNumber}</td>
                    <td className="py-1 pr-2">
                      {c.stepDescription}
                      {(c.completionNote || c.repairNote) && <span className="block text-[#8BA3BF]">{c.completionNote || c.repairNote}</span>}
                    </td>
                    <td className="py-1 pr-2">
                      {c.inputType === 'measurement'
                        ? <>{c.actualValue ?? '—'} {c.unit ?? ''} <span className="text-[#8BA3BF]">({c.acceptableMin ?? '?'}–{c.acceptableMax ?? '?'})</span>{' '}
                            {c.result && <span className={c.result === 'pass' ? 'text-[#34D399] font-semibold' : 'text-[#F87171] font-semibold'}>{c.result}</span>}</>
                        : (c.isCompleted ? '✓' : '—')}
                    </td>
                    <td className="py-1 pr-2">{c.isCompleted ? `${c.completedByName ?? '—'} · ${fmt(c.completedAt)}` : d('notDone', 'Not done')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {((wo.partsUsed ?? []).length > 0 || (wo.partsRequests ?? []).length > 0) && (
        <Section title={d('parts', 'Parts')}>
          <ul className="text-sm text-[#F0F4F8] space-y-0.5">
            {(wo.partsUsed ?? []).map((p, i) => (
              <li key={`u${i}`}>{p.partName} × {p.quantity} {p.unit}{p.totalCost ? ` · LKR ${p.totalCost.toLocaleString()}` : ''}</li>
            ))}
          </ul>
          {partsCost > 0 && <p className="text-xs text-[#B6C4D6]">{d('partsTotal', 'Parts total: LKR {{total}}', { total: partsCost.toLocaleString() })}</p>}
          {(wo.partsRequests ?? []).length > 0 && (
            <ul className="text-xs text-[#B6C4D6] space-y-0.5">
              {wo.partsRequests.map((r) => (
                <li key={r.id}>{d('partRequest', 'Requested {{part}} × {{qty}} by {{by}} ({{status}})', { part: r.partName, qty: r.quantity, by: r.requestedByName, status: r.status })}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {permits.length > 0 && (
        <Section title={d('permits', 'Work permits')}>
          <ul className="text-sm text-[#F0F4F8] space-y-0.5">
            {permits.map((p) => (
              <li key={p.id}>{p.permitNumber} · {p.title} <span className="text-[#8BA3BF]">({p.status}, {p.validFrom} → {p.validTo})</span></li>
            ))}
          </ul>
        </Section>
      )}

      {(wo.approvalRequests ?? []).length > 0 && (
        <Section title={d('approvals', 'Requested permissions / approvals')}>
          <ul className="text-sm text-[#F0F4F8] space-y-1">
            {wo.approvalRequests!.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.technicianName}</span> · {fmt(a.requestedAt)}: {a.note}
                <span className="block text-xs text-[#8BA3BF]">
                  {a.status}{a.resolvedByName ? ` — ${a.resolvedByName} · ${fmt(a.resolvedAt)}` : ''}{a.resolutionNote ? `: ${a.resolutionNote}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(wo.rootCause || wo.rootCauseDescription) && (
        <Section title={d('techRca', 'Root cause (recorded by technician)')}>
          <p className="text-sm text-[#F0F4F8]">{wo.rootCause?.replace(/_/g, ' ')}{wo.rootCauseDescription ? ` — ${wo.rootCauseDescription}` : ''}</p>
        </Section>
      )}

      <WOAiRcaCard woId={wo.id} rca={wo.aiRca} canRegenerate={canRegenerateRca} />

      {docs.length > 0 && (
        <Section title={d('documents', 'Attached documents')}>
          <ul className="text-sm space-y-0.5">
            {docs.map((doc, i) => (
              <li key={i}>
                <a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#93C5FD] hover:underline">
                  {doc.name.match(/\.(pdf|docx?|xlsx?)$/i) ? <FileText className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}{doc.name}
                </a>
                {doc.by && <span className="text-xs text-[#8BA3BF]"> · {doc.by}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
