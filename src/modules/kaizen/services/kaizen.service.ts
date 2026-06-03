import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  Timestamp,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../../../lib/firebase';
import type { UserRole } from '../../../types/auth';
import type {
  KaizenCard,
  KaizenComment,
  KaizenStatus,
  KaizenStateChange,
  KaizenStats,
  KaizenCategory,
} from '../types/kaizen.types';
import { VALID_TRANSITIONS } from '../types/kaizen.types';
import { nanoid } from 'nanoid';

// ─── Collection helpers ───────────────────────────────────────────────────────

function cardsCol(plantId: string) {
  return collection(db, 'kaizen_cards', plantId, 'cards');
}

function cardDoc(plantId: string, cardId: string) {
  return doc(db, 'kaizen_cards', plantId, 'cards', cardId);
}

// ─── Role authorization ───────────────────────────────────────────────────────

const TRANSITION_ROLES: Record<string, UserRole[]> = {
  'RAISED→REVIEWED':        ['supervisor', 'admin'],
  'REVIEWED→APPROVED':      ['supervisor', 'plant_manager', 'admin'],
  'APPROVED→IN_PROGRESS':   ['supervisor', 'admin'],
  'IN_PROGRESS→IMPLEMENTED':['supervisor', 'admin'],
  'IMPLEMENTED→VERIFIED':   ['plant_manager', 'admin'],
  'RAISED→REJECTED':        ['supervisor', 'plant_manager', 'admin'],
  'REVIEWED→REJECTED':      ['supervisor', 'plant_manager', 'admin'],
  'APPROVED→REJECTED':      ['supervisor', 'plant_manager', 'admin'],
  'RAISED→ON_HOLD':         ['supervisor', 'admin'],
  'REVIEWED→ON_HOLD':       ['supervisor', 'admin'],
  'APPROVED→ON_HOLD':       ['supervisor', 'admin'],
  'IN_PROGRESS→ON_HOLD':    ['supervisor', 'admin'],
  'IMPLEMENTED→ON_HOLD':    ['supervisor', 'admin'],
  'ON_HOLD→RAISED':         ['supervisor', 'admin'],
  'ON_HOLD→REVIEWED':       ['supervisor', 'admin'],
  'ON_HOLD→APPROVED':       ['supervisor', 'admin'],
  'ON_HOLD→IN_PROGRESS':    ['supervisor', 'admin'],
  'ON_HOLD→IMPLEMENTED':    ['supervisor', 'admin'],
};

export function canTransition(
  from: KaizenStatus,
  to: KaizenStatus,
  role: UserRole
): boolean {
  const key = `${from}→${to}`;
  const allowed = TRANSITION_ROLES[key];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function getAvailableTransitions(
  status: KaizenStatus,
  role: UserRole
): KaizenStatus[] {
  const next = VALID_TRANSITIONS[status] ?? [];
  return next.filter((s) => canTransition(status, s, role));
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export interface CreateKaizenInput {
  title: string;
  description: string;
  problemStatement: string;
  suggestedSolution: string;
  machineId?: string;
  machineName?: string;
  area: string;
  category: KaizenCard['category'];
  priority: KaizenCard['priority'];
  estimatedCost?: number;
  estimatedBenefit?: number;
  tags: string[];
  beforePhotos: string[];
  raisedBy: string;
  raisedByName: string;
  plantId: string;
}

export async function createKaizen(data: CreateKaizenInput): Promise<string> {
  const now = Timestamp.now();
  const card: Omit<KaizenCard, 'id'> = {
    title: data.title,
    description: data.description,
    problemStatement: data.problemStatement,
    suggestedSolution: data.suggestedSolution,
    machineId: data.machineId,
    machineName: data.machineName,
    area: data.area,
    raisedBy: data.raisedBy,
    raisedByName: data.raisedByName,
    raisedAt: now,
    category: data.category,
    priority: data.priority,
    status: 'RAISED',
    estimatedCost: data.estimatedCost,
    estimatedBenefit: data.estimatedBenefit,
    implementedBy: [],
    votes: [],
    voteCount: 0,
    comments: [],
    beforePhotos: data.beforePhotos,
    afterPhotos: [],
    attachments: [],
    tags: data.tags,
    plantId: data.plantId,
    stateHistory: [],
  };
  const ref = await addDoc(cardsCol(data.plantId), card);
  return ref.id;
}

export async function transitionState(
  plantId: string,
  cardId: string,
  newStatus: KaizenStatus,
  notes: string,
  userId: string,
  userName: string,
  role: UserRole,
  extra?: { rejectionReason?: string; onHoldReason?: string; onHoldUntil?: string }
): Promise<void> {
  const snap = await getDoc(cardDoc(plantId, cardId));
  if (!snap.exists()) throw new Error('Card not found');

  const card = snap.data() as KaizenCard;
  if (!canTransition(card.status, newStatus, role)) {
    throw new Error(`Role '${role}' cannot transition from ${card.status} to ${newStatus}`);
  }

  const change: KaizenStateChange = {
    fromStatus: card.status,
    toStatus: newStatus,
    changedBy: userId,
    changedByName: userName,
    changedAt: Timestamp.now(),
    notes,
  };

  const updates: Partial<KaizenCard> & Record<string, unknown> = {
    status: newStatus,
    stateHistory: arrayUnion(change) as unknown as KaizenStateChange[],
  };

  if (newStatus === 'IMPLEMENTED') {
    updates.implementedAt = Timestamp.now();
    updates.implementedBy = arrayUnion(userId) as unknown as string[];
  }
  if (newStatus === 'VERIFIED') {
    updates.verifiedBy = userId;
    updates.verifiedAt = Timestamp.now();
  }
  if (newStatus === 'REJECTED' && extra?.rejectionReason) {
    updates.rejectionReason = extra.rejectionReason;
  }
  if (newStatus === 'ON_HOLD') {
    updates.onHoldReason = extra?.onHoldReason ?? '';
    updates.onHoldUntil = extra?.onHoldUntil ?? '';
  }

  await updateDoc(cardDoc(plantId, cardId), updates);
}

export async function voteOnKaizen(
  plantId: string,
  cardId: string,
  userId: string
): Promise<void> {
  const snap = await getDoc(cardDoc(plantId, cardId));
  if (!snap.exists()) throw new Error('Card not found');
  const card = snap.data() as KaizenCard;
  const hasVoted = card.votes.includes(userId);
  await updateDoc(cardDoc(plantId, cardId), {
    votes: hasVoted ? arrayRemove(userId) : arrayUnion(userId),
    voteCount: increment(hasVoted ? -1 : 1),
  });
}

export async function addComment(
  plantId: string,
  cardId: string,
  comment: Omit<KaizenComment, 'id' | 'createdAt'>
): Promise<void> {
  const full: KaizenComment = {
    ...comment,
    id: nanoid(),
    createdAt: Timestamp.now(),
  };
  await updateDoc(cardDoc(plantId, cardId), {
    comments: arrayUnion(full),
  });
}

export async function uploadKaizenPhoto(
  file: File,
  plantId: string,
  cardId: string,
  type: 'before' | 'after'
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `kaizen/${plantId}/${cardId}/${type}_${nanoid()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const field = type === 'before' ? 'beforePhotos' : 'afterPhotos';
  await updateDoc(cardDoc(plantId, cardId), {
    [field]: arrayUnion(url),
  });

  return url;
}

// ─── ROI Calculation ─────────────────────────────────────────────────────────

export function calculateROI(card: KaizenCard): {
  roiMonths: number | null;
  totalAnnualBenefit: number;
  implementationCost: number;
} {
  const cost = card.actualCost ?? card.estimatedCost ?? 0;
  const monthlyBenefit = card.actualBenefit ?? card.estimatedBenefit ?? 0;
  const annualBenefit = monthlyBenefit * 12;

  if (cost <= 0 || monthlyBenefit <= 0) {
    return { roiMonths: null, totalAnnualBenefit: annualBenefit, implementationCost: cost };
  }

  return {
    roiMonths: Math.round((cost / monthlyBenefit) * 10) / 10,
    totalAnnualBenefit: annualBenefit,
    implementationCost: cost,
  };
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export interface KaizenFilters {
  status?: KaizenStatus;
  category?: KaizenCategory;
  machineId?: string;
  raisedBy?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export function subscribeKaizenList(
  plantId: string,
  filters: KaizenFilters,
  pageSize: number,
  onData: (cards: KaizenCard[]) => void,
  onError: (e: Error) => void,
  cursor?: QueryDocumentSnapshot<DocumentData>
) {
  let q = query(cardsCol(plantId), orderBy('raisedAt', 'desc'));

  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters.category) {
    q = query(q, where('category', '==', filters.category));
  }
  if (filters.machineId) {
    q = query(q, where('machineId', '==', filters.machineId));
  }
  if (filters.raisedBy) {
    q = query(q, where('raisedBy', '==', filters.raisedBy));
  }
  if (cursor) {
    q = query(q, startAfter(cursor));
  }
  q = query(q, limit(pageSize));

  return onSnapshot(
    q,
    (snap) => {
      let cards = snap.docs.map((d) => ({ ...d.data(), id: d.id } as KaizenCard));
      if (filters.search) {
        const s = filters.search.toLowerCase();
        cards = cards.filter(
          (c) =>
            c.title.toLowerCase().includes(s) ||
            c.problemStatement.toLowerCase().includes(s) ||
            c.area.toLowerCase().includes(s)
        );
      }
      onData(cards);
    },
    onError
  );
}

export function subscribeKaizenCard(
  plantId: string,
  cardId: string,
  onData: (card: KaizenCard | null) => void,
  onError: (e: Error) => void
) {
  return onSnapshot(
    cardDoc(plantId, cardId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ ...snap.data(), id: snap.id } as KaizenCard);
    },
    onError
  );
}

export async function fetchKaizenStats(
  plantId: string,
  startDate?: string,
  endDate?: string
): Promise<KaizenStats> {
  let q = query(cardsCol(plantId));
  if (startDate) {
    q = query(q, where('raisedAt', '>=', Timestamp.fromDate(new Date(startDate))));
  }
  if (endDate) {
    q = query(q, where('raisedAt', '<=', Timestamp.fromDate(new Date(endDate))));
  }

  const snap = await getDocs(q);
  const cards = snap.docs.map((d) => ({ ...d.data(), id: d.id } as KaizenCard));

  const byStatus = {} as Record<KaizenStatus, number>;
  const byCategory = {} as Record<KaizenCard['category'], number>;
  const contributorMap = new Map<string, { name: string; count: number }>();

  let totalImplementDays = 0;
  let implementedCount = 0;
  let totalEstBenefit = 0;
  let totalActBenefit = 0;

  for (const card of cards) {
    byStatus[card.status] = (byStatus[card.status] ?? 0) + 1;
    byCategory[card.category] = (byCategory[card.category] ?? 0) + 1;

    const existing = contributorMap.get(card.raisedBy);
    if (existing) existing.count++;
    else contributorMap.set(card.raisedBy, { name: card.raisedByName, count: 1 });

    if (
      (card.status === 'IMPLEMENTED' || card.status === 'VERIFIED') &&
      card.implementedAt
    ) {
      const days =
        (card.implementedAt.toDate().getTime() - card.raisedAt.toDate().getTime()) /
        86400000;
      totalImplementDays += days;
      implementedCount++;
    }

    if (card.estimatedBenefit) totalEstBenefit += card.estimatedBenefit;
    if (card.actualBenefit) totalActBenefit += card.actualBenefit;
  }

  const total = cards.length;
  const implementationRate = total > 0 ? Math.round((implementedCount / total) * 100) : 0;
  const avgTimeToImplement =
    implementedCount > 0 ? Math.round(totalImplementDays / implementedCount) : 0;

  const topContributors = [...contributorMap.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total,
    byStatus,
    byCategory,
    implementationRate,
    avgTimeToImplement,
    totalEstimatedBenefit: totalEstBenefit,
    totalActualBenefit: totalActBenefit,
    topContributors,
  };
}

export async function fetchKaizenTrend(
  plantId: string,
  months: number
): Promise<{ month: string; total: number; byStatus: Partial<Record<KaizenStatus, number>> }[]> {
  const snap = await getDocs(query(cardsCol(plantId)));
  const cards = snap.docs.map((d) => ({ ...d.data(), id: d.id } as KaizenCard));

  const monthMap = new Map<
    string,
    { total: number; byStatus: Partial<Record<KaizenStatus, number>> }
  >();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { total: 0, byStatus: {} });
  }

  for (const card of cards) {
    const d = card.raisedAt.toDate();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) continue;
    const entry = monthMap.get(key)!;
    entry.total++;
    entry.byStatus[card.status] = (entry.byStatus[card.status] ?? 0) + 1;
  }

  return [...monthMap.entries()].map(([month, v]) => ({ month, ...v }));
}
