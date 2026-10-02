import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notifyUsers } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import { getModuleCategory } from '@/lib/training/offboardTraining';
import { combineDueDateTime } from '@/lib/training/dueDateTime';

export interface AssignmentTrainee {
  id: string;
  fullName: string;
  email?: string | null;
  role: UserRole;
  department?: string | null;
}

export interface AssignmentAssigner {
  id: string;
  fullName?: string | null;
  role: UserRole;
}

/**
 * Assigns a training module to one company user, in-app: writes the
 * `trainingAssignments` doc and (optionally) raises an in-app notification.
 * No email is involved. Skips people who already have an active assignment
 * for the module.
 *
 * Shared by the Training tab's module assign form and the Safety Trainings
 * assign dialog so both create the exact same assignment shape.
 */
export async function createModuleAssignment(opts: {
  companyId: string;
  module: TrainingModule;
  trainee: AssignmentTrainee;
  assigner: AssignmentAssigner;
  /** 'YYYY-MM-DD' / 'HH:mm' as picked in the form — either may be empty. */
  dueDate: string;
  dueTime: string;
  notify: boolean;
  notification: { message: string; oversightMessage: string };
}): Promise<'assigned' | 'skipped'> {
  const { companyId, module, trainee, assigner } = opts;

  const existingSnap = await getDocs(
    query(
      collection(db, 'trainingAssignments'),
      where('companyId', '==', companyId),
      where('traineeId', '==', trainee.id),
      where('moduleId', '==', module.id),
    ),
  );
  const hasActive = existingSnap.docs.some((d) => {
    const data = d.data();
    return data.status !== 'certified' && data.status !== 'expired';
  });
  if (hasActive) return 'skipped';

  await addDoc(collection(db, 'trainingAssignments'), {
    companyId,
    moduleId: module.id,
    moduleName: module.title,
    machineId: module.machineId ?? '',
    machineName: module.machineName,
    traineeId: trainee.id,
    traineeName: trainee.fullName,
    traineeEmail: trainee.email ?? '',
    traineeRole: trainee.role,
    department: trainee.department ?? '',
    assignedBy: assigner.id,
    assignedByName: assigner.fullName ?? '',
    assignedAt: serverTimestamp(),
    dueDate: combineDueDateTime(opts.dueDate, opts.dueTime),
    trainingType: module.trainingType ?? null,
    trainingPeriodMonths: null,
    status: 'not_started',
    isRetraining: false,
    retrainingReason: '',
    retrainingTriggeredAt: null,
    lessonProgress: {},
    overallProgress: 0,
    lessonsCompleted: 0,
    totalLessons: module.lessons?.length ?? 0,
    // The full assignment shape. Leaving the quiz/progress fields out
    // made `attemptsUsed` undefined, so the quiz pre-screen computed
    // `maxAttempts - undefined = NaN`, showed "NaN attempts remaining"
    // and disabled Start Quiz — the assignee could never take the quiz.
    quizAttempts: [],
    bestScore: 0,
    latestScore: 0,
    quizPassed: false,
    quizPassedAt: null,
    attemptsUsed: 0,
    practicalSignOff: module.quiz
      ? {
          required: true,
          signedOffBy: '',
          signedOffByName: '',
          signedOffAt: null,
          observations: '',
          passed: false,
        }
      : null,
    certificateId: null,
    certifiedAt: null,
    certificateExpiryDate: null,
    startedAt: null,
    completedAt: null,
    lastActivityAt: null,
    category: getModuleCategory(module),
    notifyTrainee: opts.notify,
  });

  if (opts.notify) {
    void notifyUsers(companyId, [trainee.id], {
      type: 'training',
      message: opts.notification.message,
      oversightMessage: opts.notification.oversightMessage,
      actorName: assigner.fullName ?? '',
      actorRole: assigner.role,
      actorUserId: assigner.id,
      linkTo: '/app/training',
    });
  }
  return 'assigned';
}
