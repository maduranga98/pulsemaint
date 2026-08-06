import { useParams, useNavigate } from 'react-router-dom';
import { useAssignment } from '@/hooks/training/useAssignment';
import { isOffboardAssignment } from '@/lib/training/offboardTraining';
import ModuleLearningScreen from '@/components/training/learner/ModuleLearningScreen';
import OffboardTrainingCompletionForm from '@/components/training/learner/OffboardTrainingCompletionForm';

export default function ModuleLearningPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { assignment, module, loading, error } = useAssignment(assignmentId ?? '');

  // The back arrow returns to wherever the learner actually came from (the
  // dashboard, the module library, a deep link, …) rather than always
  // landing on the "My Training" list — that list isn't even reachable from
  // some roles' nav (e.g. technician), so hardcoding it as the destination
  // stranded them on a page with no way back except this same button.
  const goBack = () => navigate(-1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !assignment || !module) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-600">
        <p className="text-lg font-medium">Module not found.</p>
        <button onClick={goBack} className="text-blue-600 hover:underline text-sm">
          Go Back
        </button>
      </div>
    );
  }

  if (isOffboardAssignment(assignment)) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <OffboardTrainingCompletionForm
          assignment={assignment}
          module={module}
          onBack={goBack}
        />
      </div>
    );
  }

  return (
    <ModuleLearningScreen
      assignment={assignment}
      module={module}
      onBack={goBack}
      onStartQuiz={() => navigate(`/app/training/my-modules/${assignmentId}/quiz`)}
    />
  );
}
