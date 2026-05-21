import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTrainingModule } from '@/hooks/training/useTrainingModule';
import type { TrainingQuiz } from '@/lib/training/trainingTypes';
import QuizBuilderLayout from '@/components/training/manager/QuizBuilderLayout';

export default function QuizBuilderPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { module, loading, error } = useTrainingModule(moduleId ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveQuiz = async (quiz: TrainingQuiz) => {
    if (!moduleId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'trainingModules', moduleId), {
        quiz,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-600">
        <p className="font-medium">Module not found.</p>
        <button
          onClick={() => navigate('/app/training/manage/modules')}
          className="text-blue-600 hover:underline text-sm"
        >
          Back to Modules
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(`/app/training/manage/modules/${moduleId}`)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back to module editor"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm truncate flex-1">
          Quiz Builder — {module.title}
        </h1>
      </div>
      <QuizBuilderLayout module={module} onSaveQuiz={handleSaveQuiz} isSaving={isSaving} />
    </div>
  );
}
