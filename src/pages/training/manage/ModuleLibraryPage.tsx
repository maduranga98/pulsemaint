import TrainingModuleLibrary from '@/components/training/manager/library/TrainingModuleLibrary';
import TrainingAssignmentsProgress from '@/components/training/manager/TrainingAssignmentsProgress';

/**
 * The Training tab's landing page for admins and plant managers: the
 * Training module library, plus the live progress/marks table for everything
 * assigned out of it.
 */
export default function ModuleLibraryPage() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-slate-900">Training</h1>
      <TrainingModuleLibrary title="Modules" />
      <TrainingAssignmentsProgress />
    </div>
  );
}
