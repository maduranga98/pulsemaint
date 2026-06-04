import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '@/lib/firebase';
import type {
  CompiledShiftSummary,
  DraftHandover,
  HandoverHistoryFilters,
  PendingWOSnapshot,
  ShiftConfig,
  ShiftHandover,
  ShiftStatsAuto,
  WatchFlag,
} from '@/types/handover.types';

const functions = getFunctions(app);

type PendingWOSnapshotWire = Omit<PendingWOSnapshot, 'dueDate'> & { dueDate: string | null };
type CompiledShiftSummaryWire = Omit<CompiledShiftSummary, 'shiftStartTime' | 'compiledAt' | 'pendingWOs'> & {
  shiftStartTime: string;
  compiledAt: string;
  pendingWOs: PendingWOSnapshotWire[];
};

function toDate(value: Date | Timestamp | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return value.toDate();
}

function mapWatchFlag(flag: DocumentData): WatchFlag {
  return {
    ...flag,
    resolvedAt: toDate(flag.resolvedAt),
  } as WatchFlag;
}

function mapShiftConfig(id: string, data: DocumentData): ShiftConfig {
  return {
    id,
    companyId: data.companyId,
    shiftName: data.shiftName,
    startTime: data.startTime,
    endTime: data.endTime,
    color: data.color,
    activeDays: data.activeDays ?? [],
    department: data.department ?? null,
    status: data.status,
    createdAt: toDate(data.createdAt) ?? undefined,
    updatedAt: toDate(data.updatedAt) ?? undefined,
  };
}

function mapHandover(id: string, data: DocumentData): ShiftHandover {
  return {
    id,
    companyId: data.companyId,
    shiftConfigId: data.shiftConfigId,
    shiftName: data.shiftName,
    shiftDate: data.shiftDate,
    outgoingSupervisorId: data.outgoingSupervisorId,
    outgoingSupervisorName: data.outgoingSupervisorName,
    shiftActualStart: toDate(data.shiftActualStart) ?? new Date(),
    handoverSubmittedAt: toDate(data.handoverSubmittedAt) ?? new Date(),
    incomingSupervisorId: data.incomingSupervisorId ?? null,
    incomingSupervisorName: data.incomingSupervisorName ?? null,
    handoverAcceptedAt: toDate(data.handoverAcceptedAt),
    overlapMinutes: data.overlapMinutes ?? null,
    stats: data.stats as ShiftStatsAuto,
    watchFlags: (data.watchFlags ?? []).map(mapWatchFlag),
    pendingWOs: (data.pendingWOs ?? []).map((item: DocumentData) => ({ ...item, dueDate: toDate(item.dueDate) })),
    ongoingBreakdowns: data.ongoingBreakdowns ?? [],
    partsNotes: data.partsNotes ?? '',
    lowStockAlerts: data.lowStockAlerts ?? [],
    safetyIncidentOccurred: Boolean(data.safetyIncidentOccurred),
    safetyIncidentDescription: data.safetyIncidentDescription ?? null,
    restrictedAreas: data.restrictedAreas ?? null,
    temporaryRepairs: data.temporaryRepairs ?? null,
    generalNotes: data.generalNotes ?? '',
    outgoingAcknowledged: Boolean(data.outgoingAcknowledged),
    incomingAcknowledged: Boolean(data.incomingAcknowledged),
    status: data.status,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

export async function fetchShiftConfigs(companyId: string): Promise<ShiftConfig[]> {
  const snap = await getDocs(query(collection(db, 'shift_config'), where('companyId', '==', companyId), orderBy('startTime', 'asc')));
  return snap.docs.map((item) => mapShiftConfig(item.id, item.data()));
}

export async function saveShiftConfig(companyId: string, payload: Omit<ShiftConfig, 'id' | 'companyId'> & { id?: string }): Promise<string> {
  // Strip `id` and any other undefined values — Firestore rejects writes with undefined fields.
  const { id, ...rest } = payload;
  const data: Record<string, unknown> = { companyId };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) data[key] = value;
  }
  if (id) {
    data.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'shift_config', id), data);
    return id;
  }
  data.createdAt = serverTimestamp();
  data.updatedAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'shift_config'), data);
  return ref.id;
}

export async function autoCompileShiftSummary(params: {
  companyId: string;
  supervisorId: string;
  shiftStartTime: Date;
}): Promise<CompiledShiftSummary> {
  const callable = httpsCallable<
    { companyId: string; supervisorId: string; shiftStartTime: string },
    CompiledShiftSummaryWire
  >(functions, 'autoCompileShiftSummary');
  const result = await callable({
    companyId: params.companyId,
    supervisorId: params.supervisorId,
    shiftStartTime: params.shiftStartTime.toISOString(),
  });
  return {
    ...result.data,
    shiftStartTime: new Date(result.data.shiftStartTime),
    compiledAt: new Date(result.data.compiledAt),
    pendingWOs: result.data.pendingWOs.map((wo) => ({ ...wo, dueDate: wo.dueDate ? new Date(wo.dueDate) : null })),
  };
}

export async function submitHandoverCallable(params: {
  companyId: string;
  draft: DraftHandover;
  stats: ShiftStatsAuto;
  outgoingSupervisorId: string;
  outgoingSupervisorName: string;
}): Promise<string> {
  const callable = httpsCallable<typeof params, { handoverId: string }>(functions, 'submitHandover');
  const result = await callable(params);
  return result.data.handoverId;
}

export async function acceptHandoverCallable(handoverId: string, companyId: string): Promise<void> {
  const callable = httpsCallable<{ handoverId: string; companyId: string }, { success: boolean }>(functions, 'acceptHandover');
  await callable({ handoverId, companyId });
}

export async function fetchPendingHandover(companyId: string): Promise<ShiftHandover | null> {
  const snap = await getDocs(query(
    collection(db, 'shift_handovers'),
    where('companyId', '==', companyId),
    where('status', '==', 'pending_acceptance'),
    orderBy('handoverSubmittedAt', 'desc'),
    limit(1),
  ));
  const item = snap.docs[0];
  return item ? mapHandover(item.id, item.data()) : null;
}

export async function fetchHandoverById(companyId: string, handoverId: string): Promise<ShiftHandover | null> {
  const snap = await getDoc(doc(db, 'shift_handovers', handoverId));
  if (!snap.exists()) return null;
  const handover = mapHandover(snap.id, snap.data());
  return handover.companyId === companyId ? handover : null;
}

export async function fetchHandoverHistory(companyId: string, filters: HandoverHistoryFilters): Promise<ShiftHandover[]> {
  // NOTE: orderBy is applied client-side to avoid composite-index requirements
  // and to include docs that are missing handoverSubmittedAt.
  const constraints: QueryConstraint[] = [where('companyId', '==', companyId)];
  if (filters.shiftName) constraints.push(where('shiftName', '==', filters.shiftName));
  let snap;
  try {
    snap = await getDocs(query(collection(db, 'shift_handovers'), ...constraints));
  } catch (err) {
    console.error('fetchHandoverHistory query failed', err);
    throw err;
  }
  const rows = snap.docs.map((item) => mapHandover(item.id, item.data()));
  const filtered = rows.filter((handover) => {
    if (filters.supervisorName && !handover.outgoingSupervisorName.toLowerCase().includes(filters.supervisorName.toLowerCase())) return false;
    if (filters.dateFrom && handover.shiftDate < filters.dateFrom) return false;
    if (filters.dateTo && handover.shiftDate > filters.dateTo) return false;
    return true;
  });
  filtered.sort((a, b) => b.handoverSubmittedAt.getTime() - a.handoverSubmittedAt.getTime());
  return filtered;
}

export async function resolveWatchFlag(handoverId: string, flagId: string, userId: string): Promise<void> {
  const handoverDoc = await getDoc(doc(db, 'shift_handovers', handoverId));
  if (!handoverDoc.exists()) return;
  const handover = mapHandover(handoverDoc.id, handoverDoc.data());
  const watchFlags = handover.watchFlags.map((flag) => (
    flag.id === flagId ? { ...flag, status: 'resolved' as const, resolvedAt: new Date(), resolvedBy: userId } : flag
  ));
  await updateDoc(doc(db, 'shift_handovers', handoverId), { watchFlags, updatedAt: serverTimestamp() });
}
