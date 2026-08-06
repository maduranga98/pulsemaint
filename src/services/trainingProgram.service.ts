import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TraineeLibraryModule } from '@/lib/training/trainingTypes';
import type {
  ProgramCertificateModuleResult,
  ProgramModuleConfig,
  TrainingProgram,
} from '@/types/trainingProgram';

export interface CreateProgramInput {
  title: string;
  description: string;
  moduleConfigs: ProgramModuleConfig[];
  totalDurationDays: number;
}

export async function createTrainingProgram(
  companyId: string,
  userId: string,
  userName: string,
  input: CreateProgramInput
): Promise<string> {
  const ref = await addDoc(collection(db, 'trainingPrograms'), {
    companyId,
    title: input.title,
    description: input.description,
    moduleConfigs: input.moduleConfigs,
    totalDurationDays: input.totalDurationDays,
    status: 'active',
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Permanently removes a program template. Existing programAssignments /
 * trainingAssignments already issued from it keep their own denormalized
 * programName/moduleName, so a trainee's in-progress or completed work is
 * unaffected — this only removes the template from the catalog.
 */
export async function deleteTrainingProgram(programId: string): Promise<void> {
  await deleteDoc(doc(db, 'trainingPrograms', programId));
}

export interface TraineeTarget {
  id: string;
  fullName: string;
  email?: string | null;
  role?: string;
  department?: string | null;
}

/**
 * Assigns a program to one trainee: creates one `trainingAssignments` doc per
 * configured module (each with its own due date), then a single
 * `programAssignments` doc tying them together with the program's overall
 * due date.
 */
export async function assignProgramToTrainee(
  program: TrainingProgram,
  trainee: TraineeTarget,
  assignedBy: string,
  assignedByName: string
): Promise<void> {
  const now = new Date();
  const programDueDate = new Date(now.getTime() + program.totalDurationDays * 86400000);
  const moduleAssignmentIds: string[] = [];

  for (const cfg of program.moduleConfigs) {
    const moduleSnap = await getDoc(doc(db, 'trainingModules', cfg.moduleId));
    const module = moduleSnap.exists() ? ({ id: moduleSnap.id, ...moduleSnap.data() } as TraineeLibraryModule) : null;
    const moduleDueDate = new Date(now.getTime() + cfg.dueDays * 86400000);

    const ref = await addDoc(collection(db, 'trainingAssignments'), {
      companyId: program.companyId,
      moduleId: cfg.moduleId,
      moduleName: cfg.moduleName,
      machineId: module?.machineId ?? '',
      machineName: module?.machineName ?? '',
      traineeId: trainee.id,
      traineeName: trainee.fullName,
      traineeEmail: trainee.email ?? '',
      traineeRole: trainee.role ?? '',
      department: trainee.department ?? '',
      assignedBy,
      assignedByName,
      assignedAt: serverTimestamp(),
      dueDate: Timestamp.fromDate(moduleDueDate),
      trainingType: module?.trainingType ?? null,
      status: 'not_started',
      isRetraining: false,
      retrainingReason: '',
      retrainingTriggeredAt: null,
      lessonProgress: {},
      overallProgress: 0,
      lessonsCompleted: 0,
      totalLessons: module?.lessons?.length ?? 0,
      quizAttempts: [],
      bestScore: 0,
      latestScore: 0,
      quizPassed: false,
      quizPassedAt: null,
      attemptsUsed: 0,
      practicalSignOff: module?.quiz
        ? { required: true, signedOffBy: '', signedOffByName: '', signedOffAt: null, observations: '', passed: false }
        : null,
      certificateId: null,
      certifiedAt: null,
      certificateExpiryDate: null,
      startedAt: null,
      completedAt: null,
      lastActivityAt: null,
      category: 'machine',
      offboardDetails: null,
      offboardCompletion: null,
      programId: program.id,
    });
    moduleAssignmentIds.push(ref.id);
  }

  await addDoc(collection(db, 'programAssignments'), {
    companyId: program.companyId,
    programId: program.id,
    programName: program.title,
    traineeId: trainee.id,
    traineeName: trainee.fullName,
    assignedBy,
    assignedByName,
    assignedAt: serverTimestamp(),
    dueDate: Timestamp.fromDate(programDueDate),
    moduleAssignmentIds,
    status: 'in_progress',
    signOff: null,
    certificate: null,
  });
}

export async function signOffProgramAssignment(
  programAssignmentId: string,
  note: string,
  signedOffBy: string,
  signedOffByName: string,
  signedOffByRole: string,
  moduleResults: ProgramCertificateModuleResult[]
): Promise<void> {
  await updateDoc(doc(db, 'programAssignments', programAssignmentId), {
    status: 'signed_off',
    signOff: {
      signedOffBy,
      signedOffByName,
      signedOffByRole,
      note,
      signedOffAt: serverTimestamp(),
    },
    certificate: {
      moduleResults,
      issuedAt: serverTimestamp(),
    },
  });
}
