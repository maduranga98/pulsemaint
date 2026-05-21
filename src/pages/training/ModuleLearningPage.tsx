import { useParams, useNavigate } from 'react-router-dom';
import { useAssignment } from '@/hooks/training/useAssignment';
import ModuleLearningScreen from '@/components/training/learner/ModuleLearningScreen';

export default function ModuleLearningPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { assignment, module, loading, error } = useAssignment(assignmentId ?? '');

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
        <button
          onClick={() => navigate('/app/training/my-modules')}
          className="text-blue-600 hover:underline text-sm"
        >
          Back to My Training
        </button>
      </div>
    );
  }

  return (
    <ModuleLearningScreen
      assignment={assignment}
      module={module}
      onBack={() => navigate('/app/training/my-modules')}
      onStartQuiz={() => navigate(`/app/training/my-modules/${assignmentId}/quiz`)}
    />
  );
}
