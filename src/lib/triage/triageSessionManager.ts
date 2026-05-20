import {
  collection,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  TriageSession,
  TriageSessionStatus,
  TriageOutcomeType,
  TriageStepLog,
  TriageFlow,
  TriageLanguage,
} from '../../types/triage';

export async function createTriageSession(params: {
  companyId: string;
  machineId: string;
  machineName: string;
  flow: TriageFlow;
  supervisorId: string;
  supervisorName: string;
  language: TriageLanguage;
  breakdownTicketId?: string;
  isDemo?: boolean;
}): Promise<string> {
  const firstStep = params.flow.steps[0];
  const sessionData: Omit<TriageSession, 'id'> = {
    companyId: params.companyId,
    breakdownTicketId: params.breakdownTicketId ?? null,
    machineId: params.machineId,
    machineName: params.machineName,
    flowId: params.flow.id,
    flowName: params.flow.name,
    status: 'in_progress',
    language: params.language,
    supervisorId: params.supervisorId,
    supervisorName: params.supervisorName,
    startedAt: Timestamp.now(),
    completedAt: null,
    totalDuration: 0,
    currentStepId: firstStep?.id ?? '',
    currentStepNumber: firstStep?.stepNumber ?? 1,
    stepLogs: [],
    photosCaptured: [],
    outcomeType: null,
    outcomeNotes: '',
    escalatedAt: null,
    escalatedReason: '',
    quickFixDescription: '',
    isDemo: params.isDemo ?? false,
  };
  const ref = await addDoc(collection(db, 'triageSessions'), sessionData);
  return ref.id;
}

export async function advanceToStep(
  sessionId: string,
  stepId: string,
  stepNumber: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'triageSessions', sessionId), {
      currentStepId: stepId,
      currentStepNumber: stepNumber,
    });
  } catch (err) {
    console.error('advanceToStep error:', err);
    throw err;
  }
}

export async function logStepCompletion(
  sessionId: string,
  stepLog: TriageStepLog
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {
      stepLogs: arrayUnion(stepLog),
    };
    if (stepLog.photoUrls.length > 0) {
      updates['photosCaptured'] = arrayUnion(...stepLog.photoUrls);
    }
    await updateDoc(doc(db, 'triageSessions', sessionId), updates);
  } catch (err) {
    console.error('logStepCompletion error:', err);
    throw err;
  }
}

export async function completeSession(
  sessionId: string,
  outcomeType: TriageOutcomeType,
  outcomeNotes: string,
  startedAt: Timestamp
): Promise<void> {
  try {
    const completedAt = Timestamp.now();
    const totalDuration = completedAt.seconds - startedAt.seconds;
    await updateDoc(doc(db, 'triageSessions', sessionId), {
      status: 'completed' as TriageSessionStatus,
      completedAt,
      totalDuration,
      outcomeType,
      outcomeNotes,
    });
  } catch (err) {
    console.error('completeSession error:', err);
    throw err;
  }
}

export async function escalateSession(
  sessionId: string,
  reason: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'triageSessions', sessionId), {
      status: 'escalated' as TriageSessionStatus,
      escalatedAt: Timestamp.now(),
      escalatedReason: reason,
    });
  } catch (err) {
    console.error('escalateSession error:', err);
    throw err;
  }
}

export async function markQuickFix(
  sessionId: string,
  description: string,
  startedAt: Timestamp
): Promise<void> {
  try {
    const completedAt = Timestamp.now();
    const totalDuration = completedAt.seconds - startedAt.seconds;
    await updateDoc(doc(db, 'triageSessions', sessionId), {
      status: 'quick_fix' as TriageSessionStatus,
      completedAt,
      totalDuration,
      outcomeType: 'resolved_by_operator' as TriageOutcomeType,
      quickFixDescription: description,
    });
  } catch (err) {
    console.error('markQuickFix error:', err);
    throw err;
  }
}

export async function abandonSession(
  sessionId: string,
  reason: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'triageSessions', sessionId), {
      status: 'abandoned' as TriageSessionStatus,
      completedAt: Timestamp.now(),
      outcomeType: 'abandoned' as TriageOutcomeType,
      outcomeNotes: reason,
    });
  } catch (err) {
    console.error('abandonSession error:', err);
    throw err;
  }
}
