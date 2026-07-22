import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '@/lib/firebase';
import type {
  CompiledShiftSummary,
  DraftHandover,
  HandoverHistoryFilters,
  HandoverStatus,
  PendingWOSnapshot,
  ShiftConfig,
  ShiftHandover,
  ShiftSession,
  ShiftStatsAuto,
  WatchFlag,
} from '@/types/handover.types';
import { computeShiftTotals, scheduledShiftMinutes } from '@/utils/handover.utils';

const functions = getFunctions(app);

type PendingWOSnapshotWire = Omit<PendingWOSnapshot, 'dueDate'> & {
  // ISO string from the current Cloud Function; older deployments serialized
  // raw Firestore Timestamps as {_seconds,_nanoseconds} objects.
  dueDate: string | { seconds?: number; _seconds?: number } | null;
};

/** Parses callable wire dates: ISO strings, epoch millis, or serialized Timestamps. */
function parseWireDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object') {
    const seconds = (value as { seconds?: number; _seconds?: number }).seconds
      ?? (value as { seconds?: number; _seconds?: number })._seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
    return null;
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
type CompiledShiftSummaryWire = Omit<CompiledShiftSummary, 'shiftStartTime' | 'compiledAt' | 'pendingWOs'> & {
  shiftStartTime: string;
  compiledAt: string;
  pendingWOs: PendingWOSnapshotWire[];
};

function toDate(value: Date | Timestamp | string | number | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate();
  // Older documents stored some dates as ISO strings/epoch numbers.
  return parseWireDate(value);
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
    memberIds: data.memberIds ?? [],
    memberNames: data.memberNames ?? [],
    roles: data.roles ?? [],
    createdAt: toDate(data.createdAt) ?? undefined,
    updatedAt: toDate(data.updatedAt) ?? undefined,
  };
}

function mapShiftSession(id: string, data: DocumentData): ShiftSession {
  return {
    id,
    companyId: data.companyId,
    userId: data.userId,
    userName: data.userName ?? '',
    userRole: data.userRole ?? '',
    shiftConfigId: data.shiftConfigId ?? '',
    shiftName: data.shiftName ?? 'Shift',
    shiftDate: data.shiftDate ?? '',
    scheduledStart: data.scheduledStart ?? '',
    scheduledEnd: data.scheduledEnd ?? '',
    scheduledMinutes: data.scheduledMinutes ?? 0,
    actualStart: toDate(data.actualStart) ?? new Date(),
    actualEnd: toDate(data.actualEnd),
    totalMinutes: data.totalMinutes ?? null,
    otMinutes: data.otMinutes ?? null,
    status: data.status ?? 'active',
    handoverId: data.handoverId ?? null,
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
    outgoingSupervisorDesignation: data.outgoingSupervisorDesignation ?? null,
    shiftActualStart: toDate(data.shiftActualStart) ?? new Date(),
    shiftActualEnd: toDate(data.shiftActualEnd),
    scheduledMinutes: typeof data.scheduledMinutes === 'number' ? data.scheduledMinutes : null,
    totalMinutes: typeof data.totalMinutes === 'number' ? data.totalMinutes : null,
    otMinutes: typeof data.otMinutes === 'number' ? data.otMinutes : null,
    handoverSubmittedAt: toDate(data.handoverSubmittedAt) ?? new Date(),
    incomingSupervisorId: data.incomingSupervisorId ?? null,
    incomingSupervisorName: data.incomingSupervisorName ?? null,
    incomingSupervisorDesignation: data.incomingSupervisorDesignation ?? null,
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

/** Live shift configs — recomputes whenever a shift plan is added/edited/removed. */
export function subscribeShiftConfigs(
  companyId: string,
  callback: (configs: ShiftConfig[]) => void,
  onError?: (message: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'shift_config'), where('companyId', '==', companyId), orderBy('startTime', 'asc')),
    (snap) => callback(snap.docs.map((item) => mapShiftConfig(item.id, item.data()))),
    (err) => onError?.(err.message),
  );
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

export async function deleteShiftConfig(id: string): Promise<void> {
  await deleteDoc(doc(db, 'shift_config', id));
}

// ---------------------------------------------------------------------------
// Shift sessions — persisted start/end records with total hours + OT
// ---------------------------------------------------------------------------

export async function startShiftSession(params: {
  companyId: string;
  userId: string;
  userName: string;
  userRole: string;
  shift: ShiftConfig;
}): Promise<ShiftSession> {
  const { companyId, userId, userName, userRole, shift } = params;
  const actualStart = new Date();
  const data = {
    companyId,
    userId,
    userName,
    userRole,
    shiftConfigId: shift.id,
    shiftName: shift.shiftName,
    shiftDate: actualStart.toISOString().slice(0, 10),
    scheduledStart: shift.startTime,
    scheduledEnd: shift.endTime,
    scheduledMinutes: scheduledShiftMinutes(shift.startTime, shift.endTime),
    actualStart: Timestamp.fromDate(actualStart),
    actualEnd: null,
    totalMinutes: null,
    otMinutes: null,
    status: 'active' as const,
    handoverId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'shift_sessions'), data);
  return mapShiftSession(ref.id, { ...data, actualStart: Timestamp.fromDate(actualStart) });
}

export async function fetchActiveShiftSession(companyId: string, userId: string): Promise<ShiftSession | null> {
  const snap = await getDocs(query(
    collection(db, 'shift_sessions'),
    where('companyId', '==', companyId),
    where('userId', '==', userId),
    where('status', '==', 'active'),
    limit(1),
  ));
  const item = snap.docs[0];
  return item ? mapShiftSession(item.id, item.data()) : null;
}

export async function completeShiftSession(session: ShiftSession): Promise<ShiftSession> {
  const actualEnd = new Date();
  const { totalMinutes, otMinutes } = computeShiftTotals(
    { startTime: session.scheduledStart, endTime: session.scheduledEnd },
    session.actualStart,
    actualEnd,
  );
  await updateDoc(doc(db, 'shift_sessions', session.id), {
    actualEnd: Timestamp.fromDate(actualEnd),
    totalMinutes,
    otMinutes,
    status: 'completed',
    updatedAt: serverTimestamp(),
  });
  return { ...session, actualEnd, totalMinutes, otMinutes, status: 'completed' };
}

export async function attachHandoverToSession(sessionId: string, handoverId: string): Promise<void> {
  await updateDoc(doc(db, 'shift_sessions', sessionId), { handoverId, updatedAt: serverTimestamp() });
}

export async function fetchMyRecentSessions(companyId: string, userId: string, max = 10): Promise<ShiftSession[]> {
  // Sorted client-side to avoid a composite index requirement.
  const snap = await getDocs(query(
    collection(db, 'shift_sessions'),
    where('companyId', '==', companyId),
    where('userId', '==', userId),
  ));
  return snap.docs
    .map((item) => mapShiftSession(item.id, item.data()))
    .sort((a, b) => b.actualStart.getTime() - a.actualStart.getTime())
    .slice(0, max);
}

/**
 * SUP-023: all shift sessions (any user) for a given shiftDate, used to
 * derive a company-wide Working / Ended / Not Started status per shift plan.
 */
export async function fetchShiftSessionsForDate(companyId: string, shiftDate: string): Promise<ShiftSession[]> {
  const snap = await getDocs(query(
    collection(db, 'shift_sessions'),
    where('companyId', '==', companyId),
    where('shiftDate', '==', shiftDate),
  ));
  return snap.docs.map((item) => mapShiftSession(item.id, item.data()));
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
  // An invalid shift start would make toISOString() throw ("Invalid time
  // value") and kill the whole end-shift/handover flow. Fall back to an
  // 8-hour window ending now instead.
  const safeStart = Number.isNaN(params.shiftStartTime.getTime())
    ? new Date(Date.now() - 8 * 60 * 60 * 1000)
    : params.shiftStartTime;
  const result = await callable({
    companyId: params.companyId,
    supervisorId: params.supervisorId,
    shiftStartTime: safeStart.toISOString(),
  });
  return {
    ...result.data,
    shiftStartTime: new Date(result.data.shiftStartTime),
    compiledAt: new Date(result.data.compiledAt),
    pendingWOs: result.data.pendingWOs.map((wo) => ({ ...wo, dueDate: parseWireDate(wo.dueDate) })),
  };
}

export async function submitHandoverCallable(params: {
  companyId: string;
  draft: DraftHandover;
  stats: ShiftStatsAuto;
  outgoingSupervisorId: string;
  outgoingSupervisorName: string;
  outgoingSupervisorDesignation?: string | null;
}): Promise<string> {
  // Write the handover document directly to Firestore. (The previous
  // implementation relied on a `submitHandover` Cloud Function that may not be
  // deployed, which made the Submit button silently no-op.)
  const { companyId, draft, stats } = params;
  const now = Timestamp.now();
  const shiftDate = new Date().toISOString().slice(0, 10);

  const watchFlags = (draft.watchFlags ?? []).map((flag, index) => ({
    id: `wf-${index + 1}-${Date.now()}`,
    machineId: flag.machineId,
    machineName: flag.machineName,
    machineLocation: flag.machineLocation,
    watchLevel: flag.watchLevel,
    reason: flag.reason,
    recommendedAction: flag.recommendedAction,
    linkedBreakdownId: flag.linkedBreakdownId ?? null,
    status: 'active' as const,
    resolvedAt: null,
    resolvedBy: null,
    carriedFromHandoverId: null,
  }));

  // Invalid dates must never reach Timestamp.fromDate — it throws and the
  // whole handover submit fails with an "invalid date" error.
  const pendingWOs = (draft.pendingWOs ?? []).map((wo) => {
    const due = parseWireDate(wo.dueDate);
    return { ...wo, dueDate: due ? Timestamp.fromDate(due) : null };
  });

  // SUP-017: handing over a shift used to require a separate "pending
  // acceptance" step before it was final. That step is no longer wanted —
  // the handover now completes immediately on submit, so it's written
  // straight to `accepted` instead of `pending_acceptance` and no incoming
  // party needs to confirm it via AcceptShiftButton/acceptHandoverCallable.
  const data: Record<string, unknown> = {
    companyId,
    shiftConfigId: draft.shiftConfigId ?? '',
    shiftName: draft.shiftName ?? 'Current Shift',
    shiftDate,
    outgoingSupervisorId: params.outgoingSupervisorId,
    outgoingSupervisorName: params.outgoingSupervisorName,
    outgoingSupervisorDesignation: params.outgoingSupervisorDesignation ?? null,
    shiftActualStart: parseWireDate(draft.shiftActualStart)
      ? Timestamp.fromDate(parseWireDate(draft.shiftActualStart) as Date)
      : now,
    // SUP-020: OT = actual worked minutes beyond the scheduled shift length,
    // floored at 0 (see computeShiftTotals). Computed at end-shift time and
    // carried through the draft so it can be stored on the handover record.
    shiftActualEnd: parseWireDate(draft.shiftActualEnd)
      ? Timestamp.fromDate(parseWireDate(draft.shiftActualEnd) as Date)
      : null,
    scheduledMinutes: draft.scheduledMinutes ?? null,
    totalMinutes: draft.totalMinutes ?? null,
    otMinutes: draft.otMinutes ?? null,
    handoverSubmittedAt: now,
    incomingSupervisorId: null,
    incomingSupervisorName: null,
    incomingSupervisorDesignation: null,
    handoverAcceptedAt: now,
    overlapMinutes: 0,
    stats,
    watchFlags,
    pendingWOs,
    ongoingBreakdowns: draft.ongoingBreakdowns ?? [],
    partsNotes: draft.partsNotes ?? '',
    lowStockAlerts: draft.lowStockAlerts ?? [],
    safetyIncidentOccurred: Boolean(draft.safetyIncidentOccurred),
    safetyIncidentDescription: draft.safetyIncidentDescription ?? null,
    restrictedAreas: draft.restrictedAreas ?? null,
    temporaryRepairs: draft.temporaryRepairs ?? null,
    generalNotes: draft.generalNotes ?? '',
    outgoingAcknowledged: Boolean(draft.outgoingAcknowledged),
    incomingAcknowledged: true,
    status: 'accepted' as HandoverStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'shift_handovers'), data);
  return ref.id;
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
    if (filters.shiftName && !handover.shiftName.toLowerCase().includes(filters.shiftName.toLowerCase())) return false;
    if (filters.department && !handover.shiftName.toLowerCase().includes(filters.department.toLowerCase())) return false;
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
