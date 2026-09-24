import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { generateClaudeJson } from './claude';
import type { WOAiRca, WorkOrder } from '../types/workOrder';

// Structured-output schema — every object needs additionalProperties: false.
const RCA_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    rootCause: { type: 'string' },
    rootCauseCategory: {
      type: 'string',
      enum: ['wear_and_tear', 'operator_error', 'manufacturing_defect', 'lack_of_maintenance', 'external_damage', 'design_issue', 'unknown'],
    },
    contributingFactors: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'string' } },
    preventiveActions: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['summary', 'rootCause', 'rootCauseCategory', 'contributingFactors', 'evidence', 'preventiveActions', 'confidence'],
  additionalProperties: false,
};

type RcaResult = Omit<WOAiRca, 'source' | 'generatedAt' | 'error'>;

const fmt = (ts: { toDate?: () => Date } | null | undefined) => (ts?.toDate ? ts.toDate().toISOString() : '—');
const clip = (v: unknown, n = 600) => String(v ?? '').slice(0, n);

async function loadTickets(wo: WorkOrder): Promise<string[]> {
  const ids = Array.from(new Set([wo.linkedBreakdownId, ...(wo.linkedBreakdownIds ?? [])].filter(Boolean) as string[]));
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'breakdown_tickets', id)).catch(() => null)));
  return snaps
    .filter((s) => s?.exists())
    .map((s) => {
      const b = s!.data() as Record<string, unknown>;
      return `- ${b.ticketNumber ?? s!.id} [${b.type ?? '?'} / ${b.severity ?? '?'}]: ${clip(b.description)}` +
        (b.attemptedFixes ? ` | attempted fixes: ${clip(b.attemptedFixes, 300)}` : '') +
        (b.technicianFindings ? ` | findings: ${clip(b.technicianFindings, 300)}` : '');
    });
}

function buildPrompt(wo: WorkOrder, tickets: string[]): string {
  const lines: string[] = [];
  lines.push(`Work order ${wo.woNumber} — type ${wo.woType}, priority ${wo.priority}.`);
  lines.push(`Machine: ${wo.machineName} (${wo.machineType || 'type n/a'}), department ${wo.machineDepartment || 'n/a'}, criticality ${wo.machineCriticality}.`);
  lines.push(`Reported problem / WO description: ${clip(wo.description, 1500)}`);
  if (tickets.length) lines.push(`Breakdown tickets:\n${tickets.join('\n')}`);
  lines.push(`Timing: started ${fmt(wo.actualStartTime)}, completed ${fmt(wo.actualEndTime)}, duration ${wo.totalDurationMinutes ?? '?'} min.`);

  const checklist = (wo.checklist ?? []).map((c) => {
    const measure = c.inputType === 'measurement'
      ? ` | measured ${c.actualValue ?? '—'}${c.unit ?? ''} (acceptable ${c.acceptableMin ?? '?'}–${c.acceptableMax ?? '?'}) → ${c.result ?? 'n/a'}`
      : '';
    return `- Step ${c.stepNumber}: ${clip(c.stepDescription, 200)} — ${c.isCompleted ? `done by ${c.completedByName ?? '?'}` : 'NOT done'}${measure}` +
      (c.repairNote ? ` | repair note: ${clip(c.repairNote, 200)}` : '') +
      (c.completionNote ? ` | note: ${clip(c.completionNote, 200)}` : '');
  });
  if (checklist.length) lines.push(`Tasks & measurements:\n${checklist.join('\n')}`);

  const people = (wo.assigneeCompletions ?? []).map((c) =>
    `- ${c.technicianName}${c.technicianRole ? ` (${c.technicianRole})` : ''}, ${c.hoursWorked}h: ${clip(c.workDoneDescription, 500)}` +
    (c.completedStepsDescription ? ` | steps: ${clip(c.completedStepsDescription, 300)}` : ''));
  const logs = (wo.technicianWorkLogs ?? []).map((l) => `- ${l.technicianName}, ${l.hoursWorked}h: ${clip(l.tasksDescription, 500)}`);
  if (people.length) lines.push(`What each assigned person reported:\n${people.join('\n')}`);
  else if (logs.length) lines.push(`Work logs:\n${logs.join('\n')}`);
  if (wo.workDoneDescription) lines.push(`Work done summary: ${clip(wo.workDoneDescription, 1500)}`);

  const parts = (wo.partsUsed ?? []).map((p) => `- ${p.partName} × ${p.quantity} ${p.unit}`);
  if (parts.length) lines.push(`Parts used:\n${parts.join('\n')}`);
  const requested = (wo.partsRequests ?? []).map((r) => `- ${r.partName} × ${r.quantity} (${r.status})${r.note ? `: ${clip(r.note, 200)}` : ''}`);
  if (requested.length) lines.push(`Parts requested:\n${requested.join('\n')}`);

  const approvals = (wo.approvalRequests ?? []).map((a) =>
    `- ${a.technicianName}: "${clip(a.note, 300)}" → ${a.status}${a.resolutionNote ? ` (${clip(a.resolutionNote, 200)})` : ''}`);
  if (approvals.length) lines.push(`Approval requests raised during the job:\n${approvals.join('\n')}`);

  const holds = (wo.statusHistory ?? []).filter((h) => h.note).map((h) => `- ${h.status} by ${h.changedByName}: ${clip(h.note, 200)}`);
  if (holds.length) lines.push(`Status history notes:\n${holds.slice(-15).join('\n')}`);

  const docs = [...(wo.documents ?? []).map((d) => d.name), ...(wo.finalPhotos ?? []).map((_, i) => `final photo ${i + 1}`)];
  if (docs.length) lines.push(`Attached documents: ${docs.join(', ')}`);
  if (wo.rootCause || wo.rootCauseDescription) lines.push(`Technician's recorded root cause: ${wo.rootCause ?? ''} ${clip(wo.rootCauseDescription, 500)}`);
  if (wo.testRunResult) lines.push(`Test run: ${wo.testRunResult}${wo.testRunNotes ? ` — ${clip(wo.testRunNotes, 300)}` : ''}`);
  if (wo.machineStatusAfterRepair) lines.push(`Machine status after repair: ${wo.machineStatusAfterRepair}`);
  lines.push(`Sign-off outcome: ${wo.signOffOutcome ?? 'n/a'}${wo.signOffOutcomeReason ? ` — ${clip(wo.signOffOutcomeReason, 300)}` : ''}${wo.supervisorSignOffNotes ? ` | notes: ${clip(wo.supervisorSignOffNotes, 300)}` : ''}`);

  lines.push(
    'Using only the evidence above, determine the most probable root cause of this fault, the contributing factors, ' +
    'the specific evidence that supports it (cite measurements, notes, parts replaced), and concrete preventive actions ' +
    'to stop it recurring. If the evidence is thin, say so and lower the confidence. Keep every list item to one sentence.',
  );
  return lines.join('\n\n');
}

/**
 * Runs an AI root-cause analysis over a signed-off work order — the fault,
 * its breakdown tickets, every task and measurement, what each assigned
 * person reported, parts, approval requests and attached documents — and
 * stores the result on the WO (`aiRca`) so the signed-off summary shows it.
 * A failure is stored too (source 'failed' + error), so the summary can say
 * why and offer a retry instead of silently showing nothing.
 */
export async function generateWoAiRca(woId: string): Promise<WOAiRca> {
  const ref = doc(db, 'workOrders', woId);
  let result: WOAiRca;
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Work order not found');
    const wo = { ...snap.data(), id: snap.id } as WorkOrder;
    const tickets = await loadTickets(wo);
    const ai = await generateClaudeJson<RcaResult>(buildPrompt(wo, tickets), {
      systemInstruction:
        'You are an experienced industrial maintenance reliability engineer performing root-cause analysis on a completed, signed-off work order. Respond only with the requested JSON.',
      responseSchema: RCA_SCHEMA,
    });
    result = { ...ai, source: 'ai', generatedAt: Timestamp.now() };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const message = err instanceof Error ? err.message : String(err);
    result = {
      summary: '', rootCause: '', rootCauseCategory: 'unknown', contributingFactors: [], evidence: [],
      preventiveActions: [], confidence: 'low',
      source: 'failed', error: code ? `${code}: ${message}` : message, generatedAt: Timestamp.now(),
    };
  }
  await updateDoc(ref, { aiRca: result }).catch((e) => console.error('Failed to save AI RCA', e));
  return result;
}
