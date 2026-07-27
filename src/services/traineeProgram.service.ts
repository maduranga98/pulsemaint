import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { db, storage } from '../lib/firebase';
import type { WODocument, DocumentFileType } from '../types/workOrder';
import type { TrainingModule } from '../lib/training/trainingTypes';
import type {
  ProgrammeDurationPreset,
  ProgrammeMonth,
  TraineeProgramme,
  WeekendTaskEntry,
} from '../types/traineeProgram';
import { computeExpectedEndDate, computeDurationInMonths } from '../lib/traineeProgram/programmeDuration';

const PROGRAMMES_COL = 'traineeProgrammes';
const SUMMARIES_COL = 'weekendSummaries';

function detectFileType(file: File): DocumentFileType {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  return 'document';
}

interface CreateProgrammePayload {
  companyId: string;
  siteId: string;
  traineeId: string;
  traineeName: string;
  durationPreset: ProgrammeDurationPreset;
  startDate: Date;
  /** Required when durationPreset === 'custom'; ignored for 6/12 presets. */
  customEndDate?: Date | null;
  months: ProgrammeMonth[];
  createdBy: string;
  createdByName: string;
}

export async function createTraineeProgramme(payload: CreateProgrammePayload): Promise<string> {
  const expectedEndDate = computeExpectedEndDate(payload.durationPreset, payload.startDate, payload.customEndDate);
  const durationMonths = payload.durationPreset === 'custom'
    ? computeDurationInMonths(payload.startDate, expectedEndDate)
    : payload.durationPreset;
  const docRef = await addDoc(collection(db, PROGRAMMES_COL), {
    companyId: payload.companyId,
    siteId: payload.siteId,
    traineeId: payload.traineeId,
    traineeName: payload.traineeName,
    durationMonths,
    durationPreset: payload.durationPreset,
    startDate: Timestamp.fromDate(payload.startDate),
    expectedEndDate: Timestamp.fromDate(expectedEndDate),
    status: 'active',
    months: payload.months,
    createdBy: payload.createdBy,
    createdByName: payload.createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    finalMark: null,
    certificateId: null,
    certifiedAt: null,
  });
  return docRef.id;
}

/**
 * Creates a trainingAssignment for the trainee for each module referenced in
 * the programme's months, skipping modules that already have an active
 * (non-certified, non-expired) assignment — mirrors AssignTrainingWizard.
 */
export async function ensureModuleAssignments(
  companyId: string,
  trainee: { id: string; fullName: string; email: string | null; department: string | null },
  modules: TrainingModule[],
  assignedBy: string,
  assignedByName: string,
): Promise<void> {
  for (const mod of modules) {
    const existingSnap = await getDocs(
      query(
        collection(db, 'trainingAssignments'),
        where('companyId', '==', companyId),
        where('traineeId', '==', trainee.id),
        where('moduleId', '==', mod.id),
      ),
    );
    const hasActive = existingSnap.docs.some((d) => {
      const status = d.data().status;
      return status !== 'certified' && status !== 'expired';
    });
    if (hasActive) continue;

    await addDoc(collection(db, 'trainingAssignments'), {
      companyId,
      moduleId: mod.id,
      moduleName: mod.title,
      moduleCategory: mod.moduleCategory ?? 'machine',
      machineId: mod.machineId ?? '',
      machineName: mod.machineName ?? '',
      providerName: mod.providerName ?? '',
      traineeId: trainee.id,
      traineeName: trainee.fullName,
      traineeEmail: trainee.email ?? '',
      department: trainee.department ?? '',
      assignedBy,
      assignedByName,
      assignedAt: serverTimestamp(),
      dueDate: null,
      status: 'not_started',
      isRetraining: false,
      retrainingReason: '',
      retrainingTriggeredAt: null,
      lessonProgress: {},
      overallProgress: 0,
      lessonsCompleted: 0,
      totalLessons: mod.lessons?.length ?? 0,
      quizAttempts: [],
      bestScore: 0,
      latestScore: 0,
      quizPassed: false,
      quizPassedAt: null,
      attemptsUsed: 0,
      practicalSignOff: null,
      certificateId: null,
      certifiedAt: null,
      certificateExpiryDate: null,
      startedAt: null,
      completedAt: null,
      lastActivityAt: null,
    });
  }
}

type ProgrammeUpdate = Partial<Pick<TraineeProgramme, 'months' | 'status' | 'finalMark' | 'certificateId'>> & {
  certifiedAt?: 'now';
};

export async function updateTraineeProgramme(
  programmeId: string,
  { certifiedAt, ...data }: ProgrammeUpdate,
): Promise<void> {
  await updateDoc(doc(db, PROGRAMMES_COL, programmeId), {
    ...data,
    ...(certifiedAt === 'now' ? { certifiedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
}

interface SubmitWeekendSummaryPayload {
  companyId: string;
  programmeId: string;
  traineeId: string;
  traineeName: string;
  weekEndingDate: string;
  month: number;
  summaryText: string;
  tasks: WeekendTaskEntry[];
  files: File[];
  uploadedByName: string;
  onProgress?: (fileName: string, percent: number) => void;
}

async function uploadAttachment(
  file: File,
  companyId: string,
  summaryId: string,
  uploadedBy: string,
  uploadedByName: string,
  onProgress?: (percent: number) => void,
): Promise<WODocument> {
  const storagePath = `companies/${companyId}/trainee-programmes/weekend-summaries/${summaryId}/${Date.now()}_${file.name}`;
  const ref = storageRef(storage, storagePath);
  const task = uploadBytesResumable(ref, file);

  const url = await new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });

  return {
    id: nanoid(),
    name: file.name,
    fileType: detectFileType(file),
    format: file.name.split('.').pop()?.toUpperCase() ?? '',
    url,
    storagePath,
    fileSize: file.size,
    uploadedBy,
    uploadedByName,
    uploadedAt: Timestamp.now(),
    isCompletionDocument: false,
  };
}

export async function submitWeekendSummary(payload: SubmitWeekendSummaryPayload): Promise<string> {
  const docRef = doc(collection(db, SUMMARIES_COL));

  const attachments = await Promise.all(
    payload.files.map((file) =>
      uploadAttachment(
        file,
        payload.companyId,
        docRef.id,
        payload.traineeId,
        payload.uploadedByName,
        (p) => payload.onProgress?.(file.name, p),
      ),
    ),
  );

  await setDoc(docRef, {
    id: docRef.id,
    companyId: payload.companyId,
    programmeId: payload.programmeId,
    traineeId: payload.traineeId,
    traineeName: payload.traineeName,
    weekEndingDate: payload.weekEndingDate,
    month: payload.month,
    summaryText: payload.summaryText,
    tasks: payload.tasks,
    attachments,
    submittedAt: serverTimestamp(),
    reviewStatus: 'pending',
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewComments: '',
  });

  return docRef.id;
}

export async function reviewWeekendSummary(
  summaryId: string,
  data: { reviewStatus: 'reviewed' | 'needs_revision'; reviewComments: string; reviewedBy: string; reviewedByName: string },
): Promise<void> {
  await updateDoc(doc(db, SUMMARIES_COL, summaryId), {
    reviewStatus: data.reviewStatus,
    reviewComments: data.reviewComments,
    reviewedBy: data.reviewedBy,
    reviewedByName: data.reviewedByName,
    reviewedAt: serverTimestamp(),
  });
}
