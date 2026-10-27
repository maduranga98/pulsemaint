import type { TrainingAssignment } from './trainingTypes';

// A programme module is "done" once its final test is passed — programme
// modules aren't certified one-by-one, mirroring the same check
// TraineeProgrammePage uses to decide whether "Issue Completion Certificate"
// can be shown.
export function isModuleDone(assignments: TrainingAssignment[], traineeId: string, moduleId: string): boolean {
  // A trainee can hold more than one assignment of the same module (re-assigned
  // or retrained after a fail); the module is done as soon as any of them is
  // passed — not only the first one found, which may be an old failed attempt.
  return assignments.some(
    (a) =>
      a.traineeId === traineeId &&
      a.moduleId === moduleId &&
      (a.quizPassed === true || a.status === 'quiz_passed' || a.status === 'certified'),
  );
}
