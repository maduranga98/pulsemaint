import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
  type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  LEAD_STATUSES, statusAfterCall, statusSideEffects,
  TEAM_ROLES,
  type CallOutcome, type Lead, type LeadActivity, type LeadInput, type LeadStatus, type TeamMember,
} from '@/lib/platform/leads';

/**
 * Lumora Ventures sales pipeline (platform console, superadmin only):
 * platformLeads, platformLeadActivities, platformSalesTeam and
 * platformFeatureRequests.
 * Superadmins read/write these directly; see firestore.rules.
 */

const leadsCol = collection(db, 'platformLeads');
const actsCol = collection(db, 'platformLeadActivities');
const featuresCol = collection(db, 'platformFeatureRequests');
const teamCol = collection(db, 'platformSalesTeam');

const tsMs = (v: unknown): number | null =>
  v && typeof (v as { toMillis?: () => number }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : typeof v === 'number' ? v : null;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function toLead(id: string, d: DocumentData): Lead {
  return {
    id,
    businessName: str(d.businessName), contactPerson: str(d.contactPerson), phone: str(d.phone), email: str(d.email),
    location: str(d.location), district: str(d.district), source: str(d.source), campaign: str(d.campaign), industry: str(d.industry),
    leadDate: num(d.leadDate),
    status: (LEAD_STATUSES as readonly string[]).includes(d.status) ? d.status : 'new',
    callsMade: num(d.callsMade) ?? 0,
    nextCallAt: num(d.nextCallAt), followUpNote: str(d.followUpNote), demoAt: num(d.demoAt), demoRequested: d.demoRequested === true,
    priceQuoted: str(d.priceQuoted), closedAmount: num(d.closedAmount) ?? 0, currency: d.currency === 'USD' ? 'USD' : 'LKR',
    closedAt: num(d.closedAt), mainProblem: str(d.mainProblem), tags: Array.isArray(d.tags) ? d.tags.filter((t: unknown) => typeof t === 'string') : [],
    notes: str(d.notes), assignedTo: d.assignedTo ?? null, marketerId: d.marketerId ?? null, companyId: d.companyId ?? null, archived: d.archived === true,
    createdAt: tsMs(d.createdAt), updatedAt: tsMs(d.updatedAt), lastActivityAt: num(d.lastActivityAt), createdByEmail: d.createdByEmail ?? null,
  };
}

function toActivity(id: string, d: DocumentData): LeadActivity {
  return {
    id, leadId: str(d.leadId), leadName: str(d.leadName), type: d.type, outcome: d.outcome ?? null, callNumber: num(d.callNumber),
    body: str(d.body), statusFrom: d.statusFrom ?? null, statusTo: d.statusTo ?? null, nextCallAt: num(d.nextCallAt),
    at: num(d.at) ?? 0, authorEmail: d.authorEmail ?? null,
  };
}

function me() {
  const u = auth.currentUser;
  return { uid: u?.uid ?? '', email: u?.email ?? null };
}

function cleanInput(input: Partial<LeadInput>): Partial<LeadInput> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = typeof v === 'string' ? v.trim().slice(0, k === 'notes' || k === 'mainProblem' ? 5000 : 500) : v;
  return out as Partial<LeadInput>;
}

/** Every lead (archived included — the page filters). Pipelines stay in the hundreds, so one listener is fine. */
export function subscribeLeads(cb: (rows: Lead[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(leadsCol, (snap) => cb(snap.docs.map((d) => toLead(d.id, d.data()))), onError);
}

/** Open leads with a next call booked up to `untilMs` (nav badge). */
export function subscribeCallsDue(untilMs: number, cb: (count: number) => void): Unsubscribe {
  return onSnapshot(
    query(leadsCol, where('nextCallAt', '<=', untilMs)),
    (snap) => cb(snap.docs.filter((d) => d.get('archived') !== true && !['closed_won', 'closed_lost'].includes(d.get('status'))).length),
    () => cb(0),
  );
}

export function subscribeLeadActivities(leadId: string, cb: (rows: LeadActivity[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(actsCol, where('leadId', '==', leadId)),
    (snap) => cb(snap.docs.map((d) => toActivity(d.id, d.data())).sort((a, b) => b.at - a.at)),
    onError,
  );
}

export async function getActivitiesBetween(fromMs: number, toMs: number): Promise<LeadActivity[]> {
  const snap = await getDocs(query(actsCol, where('at', '>=', fromMs), where('at', '<=', toMs)));
  return snap.docs.map((d) => toActivity(d.id, d.data()));
}

function logActivity(lead: Pick<Lead, 'id' | 'businessName'>, a: Partial<Omit<LeadActivity, 'id' | 'leadId' | 'leadName' | 'authorEmail'>> & { type: LeadActivity['type'] }) {
  const { uid, email } = me();
  return addDoc(actsCol, {
    leadId: lead.id, leadName: lead.businessName, outcome: null, callNumber: null, body: '', statusFrom: null, statusTo: null,
    nextCallAt: null, at: Date.now(), ...a, authorUid: uid, authorEmail: email, createdAt: serverTimestamp(),
  });
}

export async function createLead(input: LeadInput): Promise<string> {
  const { uid, email } = me();
  const now = Date.now();
  const ref = await addDoc(leadsCol, {
    ...cleanInput(input), archived: false, closedAt: input.status === 'closed_won' || input.status === 'closed_lost' ? now : null,
    lastActivityAt: null, createdBy: uid, createdByEmail: email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Bulk import in batches of 400 (Firestore's batch limit is 500). */
export async function importLeads(inputs: LeadInput[]): Promise<number> {
  const { uid, email } = me();
  for (let i = 0; i < inputs.length; i += 400) {
    const batch = writeBatch(db);
    for (const input of inputs.slice(i, i + 400)) {
      batch.set(doc(leadsCol), {
        ...cleanInput(input), archived: false, closedAt: null, lastActivityAt: null, createdBy: uid, createdByEmail: email,
        importedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return inputs.length;
}

/** Edit a lead; a status change is logged to its history. */
export async function updateLead(lead: Lead, patch: Partial<LeadInput>): Promise<void> {
  const next = cleanInput(patch);
  const statusChanged = next.status && next.status !== lead.status;
  await updateDoc(doc(leadsCol, lead.id), {
    ...next,
    ...(statusChanged ? statusSideEffects(lead.status, next.status as LeadStatus) : {}),
    updatedAt: serverTimestamp(),
  });
  if (statusChanged) await logActivity(lead, { type: 'status', statusFrom: lead.status, statusTo: next.status as LeadStatus });
}

export async function setLeadStatus(lead: Lead, status: LeadStatus): Promise<void> {
  if (status === lead.status) return;
  await updateLead(lead, { status });
}

export async function logCall(lead: Lead, input: { outcome: CallOutcome; body: string; nextCallAt: number | null; followUpNote?: string }): Promise<void> {
  const callNumber = lead.callsMade + 1;
  const status = statusAfterCall(lead.status, input.outcome, !!input.nextCallAt);
  const now = Date.now();
  await updateDoc(doc(leadsCol, lead.id), {
    callsMade: callNumber,
    nextCallAt: input.nextCallAt,
    ...(input.followUpNote !== undefined ? { followUpNote: input.followUpNote.trim().slice(0, 500) } : {}),
    status,
    ...statusSideEffects(lead.status, status, now),
    lastActivityAt: now,
    updatedAt: serverTimestamp(),
  });
  await logActivity(lead, {
    type: 'call', outcome: input.outcome, callNumber, body: input.body.trim().slice(0, 5000), nextCallAt: input.nextCallAt,
    statusFrom: lead.status, statusTo: status, at: now,
  });
}

export async function addLeadNote(lead: Lead, body: string): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(leadsCol, lead.id), { lastActivityAt: now, updatedAt: serverTimestamp() });
  await logActivity(lead, { type: 'note', body: body.trim().slice(0, 5000), at: now });
}

export async function bookDemo(lead: Lead, demoAt: number, body: string): Promise<void> {
  const early: LeadStatus[] = ['new', 'called', 'not_answered', 'follow_up'];
  const status: LeadStatus = early.includes(lead.status) ? 'demo_booked' : lead.status;
  const now = Date.now();
  await updateDoc(doc(leadsCol, lead.id), { demoAt, status, lastActivityAt: now, updatedAt: serverTimestamp() });
  await logActivity(lead, { type: 'demo', body: body.trim().slice(0, 5000), statusFrom: lead.status, statusTo: 'demo_booked', nextCallAt: demoAt, at: now });
}

export async function markDemoDone(lead: Lead, body: string): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(leadsCol, lead.id), { status: 'demo_done', lastActivityAt: now, updatedAt: serverTimestamp() });
  await logActivity(lead, { type: 'demo', body: body.trim().slice(0, 5000), statusFrom: lead.status, statusTo: 'demo_done', at: now });
}

/** Take a lead off the Calls list without logging a call. */
export function clearNextCall(leadId: string): Promise<void> {
  return updateDoc(doc(leadsCol, leadId), { nextCallAt: null, updatedAt: serverTimestamp() });
}

export function setArchived(leadId: string, archived: boolean): Promise<void> {
  return updateDoc(doc(leadsCol, leadId), { archived, updatedAt: serverTimestamp() });
}

/** Permanently delete a lead and its history (for mistaken imports / duplicates). */
export async function deleteLead(leadId: string): Promise<void> {
  const acts = await getDocs(query(actsCol, where('leadId', '==', leadId)));
  for (let i = 0; i < acts.docs.length; i += 400) {
    const batch = writeBatch(db);
    acts.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(leadsCol, leadId));
}

// ---------------------------------------------------------------------------
// Feature requests & bugs raised while talking to leads / customers.
// ---------------------------------------------------------------------------

export type FeatureRequestType = 'feature' | 'bug';
export const FEATURE_REQUEST_STATUSES = ['requested', 'in_progress', 'testing', 'closed'] as const;
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number];
export const FEATURE_STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  requested: 'Requested', in_progress: 'In progress', testing: 'Testing', closed: 'Closed',
};

export interface FeatureRequest {
  id: string;
  type: FeatureRequestType;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  leadId: string | null;
  leadName: string | null;
  /** How to verify the fix/feature — filled in when moving to Testing. */
  howToTest: string;
  createdAt: number | null;
  createdByEmail: string | null;
}

function toFeature(id: string, d: DocumentData): FeatureRequest {
  return {
    id, type: d.type === 'bug' ? 'bug' : 'feature', title: str(d.title), description: str(d.description),
    status: (FEATURE_REQUEST_STATUSES as readonly string[]).includes(d.status) ? d.status : 'requested',
    leadId: d.leadId ?? null, leadName: d.leadName ?? null, howToTest: str(d.howToTest), createdAt: tsMs(d.createdAt), createdByEmail: d.createdByEmail ?? null,
  };
}

export function subscribeFeatureRequests(cb: (rows: FeatureRequest[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(featuresCol, (snap) => cb(snap.docs.map((d) => toFeature(d.id, d.data())).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))), onError);
}

export async function createFeatureRequest(input: { type: FeatureRequestType; title: string; description: string; lead?: Pick<Lead, 'id' | 'businessName' | 'tags'> | null }): Promise<void> {
  const { uid, email } = me();
  await addDoc(featuresCol, {
    type: input.type, title: input.title.trim().slice(0, 200), description: input.description.trim().slice(0, 5000), status: 'requested',
    leadId: input.lead?.id ?? null, leadName: input.lead?.businessName ?? null, howToTest: '',
    createdBy: uid, createdByEmail: email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  // Tag the lead so the board shows it raised a feature/bug.
  if (input.lead) {
    const tag = input.type === 'bug' ? 'Bug' : 'Feature';
    if (!input.lead.tags.includes(tag)) await updateDoc(doc(leadsCol, input.lead.id), { tags: [...input.lead.tags, tag], updatedAt: serverTimestamp() });
  }
}

export function updateFeatureRequest(id: string, patch: Partial<Pick<FeatureRequest, 'status' | 'howToTest' | 'title' | 'description'>>): Promise<void> {
  return updateDoc(doc(featuresCol, id), { ...patch, updatedAt: serverTimestamp() });
}

export function deleteFeatureRequest(id: string): Promise<void> {
  return deleteDoc(doc(featuresCol, id));
}

// ---------------------------------------------------------------------------
// Sales team — outside marketers, referral agents and callers. A roster only:
// they get no FirmiCore login (superadmin stays email-allowlisted).
// ---------------------------------------------------------------------------

function toMember(id: string, d: DocumentData): TeamMember {
  return {
    id, name: str(d.name), phone: str(d.phone), email: str(d.email),
    role: (TEAM_ROLES as readonly string[]).includes(d.role) ? d.role : 'marketer',
    commissionPct: num(d.commissionPct) ?? 0, active: d.active !== false, notes: str(d.notes),
  };
}

export function subscribeTeam(cb: (rows: TeamMember[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(teamCol, (snap) => cb(snap.docs.map((d) => toMember(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))), onError);
}

export async function saveTeamMember(member: Omit<TeamMember, 'id'> & { id?: string }): Promise<void> {
  const { id, ...rest } = member;
  const data = {
    ...rest, name: rest.name.trim().slice(0, 200), phone: rest.phone.trim().slice(0, 50), email: rest.email.trim().slice(0, 200),
    notes: rest.notes.trim().slice(0, 2000), commissionPct: Math.min(100, Math.max(0, rest.commissionPct || 0)), updatedAt: serverTimestamp(),
  };
  if (id) await updateDoc(doc(teamCol, id), data);
  else await addDoc(teamCol, { ...data, createdBy: me().uid, createdAt: serverTimestamp() });
}

/** Remove a member and unassign their leads (history keeps who logged what). */
export async function deleteTeamMember(id: string): Promise<void> {
  const [assigned, brought] = await Promise.all([
    getDocs(query(leadsCol, where('assignedTo', '==', id))),
    getDocs(query(leadsCol, where('marketerId', '==', id))),
  ]);
  const updates = new Map<string, Record<string, null>>();
  assigned.docs.forEach((d) => updates.set(d.id, { ...(updates.get(d.id) ?? {}), assignedTo: null }));
  brought.docs.forEach((d) => updates.set(d.id, { ...(updates.get(d.id) ?? {}), marketerId: null }));
  const entries = [...updates.entries()];
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([leadId, patch]) => batch.update(doc(leadsCol, leadId), patch));
    await batch.commit();
  }
  await deleteDoc(doc(teamCol, id));
}

/** Reassign many leads at once (board bulk action). */
export async function assignLeads(leadIds: string[], assignedTo: string | null): Promise<void> {
  for (let i = 0; i < leadIds.length; i += 400) {
    const batch = writeBatch(db);
    leadIds.slice(i, i + 400).forEach((id) => batch.update(doc(leadsCol, id), { assignedTo, updatedAt: serverTimestamp() }));
    await batch.commit();
  }
}
