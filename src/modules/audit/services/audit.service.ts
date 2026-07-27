import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { db, storage } from '../../../lib/firebase';
import type {
  AuditCategory,
  BuiltinAuditCategory,
  AuditTemplate,
  AuditTask,
  AuditSession,
  AuditAttachment,
  AttachmentType,
  AuditDraft,
  AuditScope,
  FindingKind,
} from '../types/audit.types';
import { normalizeTemplate, ALL_FINDING_KINDS } from '../types/audit.types';
import { DEFAULT_TASKS } from '../data/defaultTemplates';
import { analyzeAuditWithAI, buildFailedAnswerInputs } from '../utils/aiRootCause';
import { auditPdfBlob } from '../utils/auditPdf';

// Firestore layout:
//   audit_templates/{plantId}/templates/{templateId}
//   audit_sessions/{plantId}/sessions/{sessionId}
const templatesCol = (plantId: string) => collection(db, 'audit_templates', plantId, 'templates');
const sessionsCol = (plantId: string) => collection(db, 'audit_sessions', plantId, 'sessions');

// ─── Templates ──────────────────────────────────────────────────────────────

export function subscribeTemplates(
  plantId: string,
  onData: (templates: AuditTemplate[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(templatesCol(plantId), orderBy('category'));
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => normalizeTemplate({ id: d.id, ...d.data() } as AuditTemplate))),
    onError,
  );
}

/**
 * Ensures every category has at least one template by seeding editable copies
 * of the built-in defaults the first time the audit module is opened.
 */
export async function ensureDefaultTemplates(plantId: string): Promise<void> {
  const snap = await getDocs(templatesCol(plantId));
  const existing = new Set(snap.docs.map((d) => (d.data() as AuditTemplate).category));
  const categories: BuiltinAuditCategory[] = ['tpm', 'fives', 'moe', 'contractor'];

  await Promise.all(
    categories
      .filter((c) => !existing.has(c))
      .map((category) => {
        const id = `default_${category}`;
        const tmpl: Omit<AuditTemplate, 'id'> = {
          category,
          name: `Standard ${category.toUpperCase()} Checklist`,
          tasks: DEFAULT_TASKS[category].map((task) => ({ ...task, id: nanoid() })),
          plantId,
          isDefault: true,
          updatedAt: Timestamp.now(),
          scope: category === 'contractor' ? 'contractors' : 'machines',
          enabledFindingKinds: ALL_FINDING_KINDS,
        };
        return setDoc(doc(templatesCol(plantId), id), tmpl);
      }),
  );
}

export async function saveTemplate(
  plantId: string,
  template: Omit<AuditTemplate, 'id'> & { id?: string },
): Promise<string> {
  const { id, ...data } = template;
  const payload = { ...data, plantId, updatedAt: serverTimestamp() };
  if (id) {
    await setDoc(doc(templatesCol(plantId), id), payload, { merge: true });
    return id;
  }
  const ref = await addDoc(templatesCol(plantId), payload);
  return ref.id;
}

export async function deleteTemplate(plantId: string, templateId: string): Promise<void> {
  await deleteDoc(doc(templatesCol(plantId), templateId));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'category';
}

/**
 * Creates a brand-new admin-defined audit category + template. The category
 * id is slugified from the name and de-duplicated against existing templates
 * for the plant (server-side `create` is admin-only, see firestore.rules).
 */
export async function createCustomCategory(
  plantId: string,
  name: string,
  tasks: AuditTask[],
  scope: AuditScope = 'machines',
  enabledFindingKinds: FindingKind[] = ALL_FINDING_KINDS,
): Promise<AuditTemplate> {
  const snap = await getDocs(templatesCol(plantId));
  const existingCategories = new Set(snap.docs.map((d) => (d.data() as AuditTemplate).category));

  const base = slugify(name);
  let category = base;
  let n = 2;
  while (existingCategories.has(category)) {
    category = `${base}_${n++}`;
  }

  const id = `custom_${category}`;
  const payload: Omit<AuditTemplate, 'id'> = {
    category,
    name: name.trim() || 'Custom Audit',
    tasks,
    plantId,
    isDefault: false,
    updatedAt: serverTimestamp() as unknown as AuditTemplate['updatedAt'],
    scope,
    enabledFindingKinds,
  };
  await setDoc(doc(templatesCol(plantId), id), payload);
  return { id, ...payload };
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function uploadAttachment(
  plantId: string,
  sessionKey: string,
  file: File,
  type: AttachmentType,
): Promise<AuditAttachment> {
  const id = nanoid();
  const path = `audit_attachments/${plantId}/${sessionKey}/${type}/${id}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { id, type, name: file.name, url, mimeType: file.type, size: file.size };
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export function subscribeSessions(
  plantId: string,
  filters: { category?: AuditCategory; department?: string; machineId?: string },
  onData: (sessions: AuditSession[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const constraints: Parameters<typeof query>[1][] = [orderBy('createdAt', 'desc'), limit(100)];
  if (filters.category) constraints.unshift(where('category', '==', filters.category));
  if (filters.department) constraints.unshift(where('department', '==', filters.department));
  const q = query(sessionsCol(plantId), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditSession));
      if (filters.machineId) {
        rows = rows.filter((s) => s.machines.some((m) => m.id === filters.machineId));
      }
      onData(rows);
    },
    onError,
  );
}

export async function fetchSession(plantId: string, sessionId: string): Promise<AuditSession | null> {
  const d = await getDoc(doc(sessionsCol(plantId), sessionId));
  return d.exists() ? ({ id: d.id, ...d.data() } as AuditSession) : null;
}

/**
 * Fetches Contractor Audit sessions that rated a given contractor, via the
 * denormalized `contractorIds` array (set on submit for `category ===
 * 'contractor'` sessions) — Firestore can't query array-of-objects
 * (`contractors[].id`) directly, hence the flat id array.
 */
export async function fetchSessionsByContractor(plantId: string, contractorId: string): Promise<AuditSession[]> {
  const q = query(
    sessionsCol(plantId),
    where('contractorIds', 'array-contains', contractorId),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditSession));
}

/**
 * Submits an audit: runs AI root-cause analysis on findings + failed tasks,
 * persists the session, then generates & uploads a PDF report and links it.
 */
export async function submitAudit(
  plantId: string,
  draft: Omit<AuditSession, 'id' | 'status' | 'reportUrl' | 'createdAt' | 'submittedAt' | 'aiSuggestions'>,
): Promise<AuditSession> {
  const aiSuggestions = await analyzeAuditWithAI(draft.findings, buildFailedAnswerInputs(draft));

  const base: Omit<AuditSession, 'id'> = {
    ...draft,
    aiSuggestions,
    status: 'submitted',
    reportUrl: null,
    createdAt: Timestamp.now(),
    submittedAt: Timestamp.now(),
  };

  const docRef = await addDoc(sessionsCol(plantId), base);
  const session: AuditSession = { id: docRef.id, ...base };

  // Auto-generate the PDF report and attach it.
  try {
    const blob = auditPdfBlob(session);
    const path = `audit_reports/${plantId}/${docRef.id}.pdf`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
    const reportUrl = await getDownloadURL(storageRef);
    await updateDoc(docRef, { reportUrl });
    session.reportUrl = reportUrl;
  } catch (e) {
    // Report generation/upload failures must not lose the audit record.
    console.error('Audit PDF generation failed', e);
  }

  return session;
}

// ─── Draft (localStorage) ─────────────────────────────────────────────────────

const DRAFT_KEY = (plantId: string, category: AuditCategory) => `audit_draft_${plantId}_${category}`;

export function saveDraft(plantId: string, draft: AuditDraft): void {
  localStorage.setItem(DRAFT_KEY(plantId, draft.category), JSON.stringify(draft));
}

export function loadDraft(plantId: string, category: AuditCategory): AuditDraft | null {
  const raw = localStorage.getItem(DRAFT_KEY(plantId, category));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditDraft;
  } catch {
    return null;
  }
}

export function clearDraft(plantId: string, category: AuditCategory): void {
  localStorage.removeItem(DRAFT_KEY(plantId, category));
}
