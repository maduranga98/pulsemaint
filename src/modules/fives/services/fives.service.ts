import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase';
import type {
  FiveSAudit,
  AuditZone,
  CorrectiveAction,
  AuditItemScore,
  AuditDraft,
  PillarId,
} from '../types/fives.types';
import { DEFAULT_CHECKLIST } from '../data/defaultChecklist';

// ─── Score Calculations ───────────────────────────────────────────────────────

export function calculatePillarScore(itemScores: AuditItemScore[]): number {
  if (itemScores.length === 0) return 0;
  const sum = itemScores.reduce((acc, s) => acc + s.score, 0);
  return sum / itemScores.length;
}

export function calculateOverallScore(pillarScores: Record<PillarId, number>): number {
  const values = Object.values(pillarScores);
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round((avg / 4) * 100);
}

// ─── Zones ────────────────────────────────────────────────────────────────────

export function subscribeZones(
  plantId: string,
  onData: (zones: AuditZone[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const col = collection(db, 'fives_zones', plantId, 'zones');
  const q = query(col, where('isActive', '==', true), orderBy('name'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditZone))),
    onError,
  );
}

export async function createZone(plantId: string, zone: Omit<AuditZone, 'id'>): Promise<string> {
  const col = collection(db, 'fives_zones', plantId, 'zones');
  const ref = await addDoc(col, zone);
  return ref.id;
}

export async function updateZone(plantId: string, zoneId: string, updates: Partial<AuditZone>): Promise<void> {
  const d = doc(db, 'fives_zones', plantId, 'zones', zoneId);
  await updateDoc(d, updates as Record<string, unknown>);
}

// ─── Audits ───────────────────────────────────────────────────────────────────

export function subscribeAudits(
  plantId: string,
  zoneId: string | null,
  limitCount: number,
  onData: (audits: FiveSAudit[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const col = collection(db, 'fives_audits', plantId, 'audits');
  let q = zoneId
    ? query(col, where('zoneId', '==', zoneId), orderBy('auditDate', 'desc'), limit(limitCount))
    : query(col, orderBy('auditDate', 'desc'), limit(limitCount));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FiveSAudit))),
    onError,
  );
}

export async function fetchAuditsByDateRange(
  plantId: string,
  zoneId: string,
  startDate: string,
  endDate: string,
): Promise<FiveSAudit[]> {
  const col = collection(db, 'fives_audits', plantId, 'audits');
  const q = query(
    col,
    where('zoneId', '==', zoneId),
    where('auditDate', '>=', startDate),
    where('auditDate', '<=', endDate),
    orderBy('auditDate', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FiveSAudit));
}

export async function fetchAuditById(plantId: string, auditId: string): Promise<FiveSAudit | null> {
  const d = await getDoc(doc(db, 'fives_audits', plantId, 'audits', auditId));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() } as FiveSAudit;
}

export async function verifyAudit(
  plantId: string,
  auditId: string,
  verifiedBy: string,
): Promise<void> {
  const d = doc(db, 'fives_audits', plantId, 'audits', auditId);
  await updateDoc(d, {
    status: 'verified',
    verifiedAt: Timestamp.now(),
    verifiedBy,
  });
}

// ─── Corrective Actions ───────────────────────────────────────────────────────

export async function autoCreateCorrectiveActions(
  audit: FiveSAudit,
  plantId: string,
): Promise<CorrectiveAction[]> {
  const created: CorrectiveAction[] = [];

  for (const itemScore of audit.itemScores) {
    if (itemScore.score > 1) continue;

    const pillar = DEFAULT_CHECKLIST.find((p) =>
      p.checklistItems.some((ci) => ci.id === itemScore.checkItemId),
    );
    const item = pillar?.checklistItems.find((ci) => ci.id === itemScore.checkItemId);
    if (!item) continue;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (itemScore.score === 0 ? 3 : 7));

    const ca: Omit<CorrectiveAction, 'id'> = {
      auditId: audit.id,
      zoneId: audit.zoneId,
      zoneName: audit.zoneName,
      checkItemId: itemScore.checkItemId,
      checkItemDescription: item.description,
      pillarId: item.pillarId,
      description: `[${pillar?.name}] ${item.description}${itemScore.notes ? ' — ' + itemScore.notes : ''}`,
      severity: itemScore.score === 0 ? 'immediate' : 'standard',
      assignedTo: '',
      dueDate: dueDate.toISOString().split('T')[0],
      status: 'open',
      closureNotes: '',
      closurePhotos: [],
      closedAt: null,
      closedBy: null,
      plantId,
      createdAt: Timestamp.now(),
    };

    const ref = await addDoc(
      collection(db, 'fives_corrective_actions', plantId, 'actions'),
      ca,
    );
    created.push({ id: ref.id, ...ca });
  }

  return created;
}

export function subscribeCorrectiveActions(
  plantId: string,
  filters: {
    zoneId?: string;
    status?: string;
    assignedTo?: string;
  },
  onData: (actions: CorrectiveAction[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const col = collection(db, 'fives_corrective_actions', plantId, 'actions');
  let constraints: Parameters<typeof query>[1][] = [orderBy('createdAt', 'desc')];

  if (filters.zoneId) constraints.push(where('zoneId', '==', filters.zoneId));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.assignedTo) constraints.push(where('assignedTo', '==', filters.assignedTo));

  const q = query(col, ...constraints);
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CorrectiveAction))),
    onError,
  );
}

export async function updateCorrectiveAction(
  plantId: string,
  actionId: string,
  updates: Partial<CorrectiveAction>,
): Promise<void> {
  const d = doc(db, 'fives_corrective_actions', plantId, 'actions', actionId);
  await updateDoc(d, updates as Record<string, unknown>);
}

export async function closeCorrectiveAction(
  plantId: string,
  actionId: string,
  closedBy: string,
  closureNotes: string,
  closurePhotos: string[],
): Promise<void> {
  const d = doc(db, 'fives_corrective_actions', plantId, 'actions', actionId);
  await updateDoc(d, {
    status: 'closed',
    closedBy,
    closureNotes,
    closurePhotos,
    closedAt: Timestamp.now(),
  });
}

// ─── Photo Upload ─────────────────────────────────────────────────────────────

export function uploadAuditPhoto(
  file: File,
  plantId: string,
  auditId: string,
  itemId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const path = `audits/${plantId}/${auditId}/${itemId}/${Date.now()}.jpg`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      (snap) => onProgress && onProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      },
    );
  });
}

// ─── Submit Audit ─────────────────────────────────────────────────────────────

export async function submitAudit(
  draft: Omit<FiveSAudit, 'id'>,
  plantId: string,
): Promise<string> {
  const col = collection(db, 'fives_audits', plantId, 'audits');
  const docRef = await addDoc(col, {
    ...draft,
    status: 'submitted',
    submittedAt: Timestamp.now(),
  });

  // Update zone's last audit info
  const zoneRef = doc(db, 'fives_zones', plantId, 'zones', draft.zoneId);
  await updateDoc(zoneRef, {
    lastAuditDate: draft.auditDate,
    lastAuditScore: draft.overallScore,
  });

  const fullAudit: FiveSAudit = { id: docRef.id, ...draft, status: 'submitted', submittedAt: Timestamp.now(), verifiedAt: null, verifiedBy: null };
  const caList = await autoCreateCorrectiveActions(fullAudit, plantId);
  const caIds = caList.map((ca) => ca.id);

  if (caIds.length > 0) {
    await updateDoc(docRef, { correctiveActions: caIds });
  }

  return docRef.id;
}

// ─── Draft (localStorage) ─────────────────────────────────────────────────────

const DRAFT_KEY = (plantId: string) => `fives_draft_${plantId}`;

export function saveDraft(plantId: string, draft: AuditDraft): void {
  localStorage.setItem(DRAFT_KEY(plantId), JSON.stringify(draft));
}

export function loadDraft(plantId: string): AuditDraft | null {
  const raw = localStorage.getItem(DRAFT_KEY(plantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditDraft;
  } catch {
    return null;
  }
}

export function clearDraft(plantId: string): void {
  localStorage.removeItem(DRAFT_KEY(plantId));
}

// ─── Factory Score ────────────────────────────────────────────────────────────

export async function fetchFactoryScore(plantId: string): Promise<number> {
  const zonesCol = collection(db, 'fives_zones', plantId, 'zones');
  const zonesSnap = await getDocs(query(zonesCol, where('isActive', '==', true)));
  const zones = zonesSnap.docs.map((d) => d.data() as AuditZone);

  const scores = zones
    .map((z) => z.lastAuditScore)
    .filter((s): s is number => s !== null && s !== undefined);

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
