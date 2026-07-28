import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTraineeList } from '@/hooks/training/useTraineeList';
import { useTraineeWorkOrderCounts } from '@/hooks/training/useTraineeWorkOrderCounts';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import TraineeManagementList from '@/components/training/manager/TraineeManagementList';
import ModuleLibrarySection from '@/components/training/manager/ModuleLibrarySection';
import OffboardTrainingReportViewer from '@/components/training/manager/OffboardTrainingReportViewer';

export default function AssignmentsListPage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportAssignment, setReportAssignment] = useState<TrainingAssignment | null>(null);

  const { trainees, loading: traineesLoading } = useTraineeList();
  const { counts: woCounts } = useTraineeWorkOrderCounts();

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const q = query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId));

    const unsub = onSnapshot(q, (snap) => {
      // Trainee Management only tracks trainee-role assignments — legacy
      // assignments made before traineeRole was recorded (or made to other
      // workforce roles, back when this flow wasn't trainee-only) are
      // excluded rather than shown alongside them.
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment))
        .filter((a) => a.traineeRole === 'trainee');
      setAssignments(rows);
      setLoading(false);
    });

    return () => unsub();
  }, [companyId]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Trainee Management</h1>
        <button
          onClick={() => navigate('/app/training/manage/assign')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Assign Training
        </button>
      </div>

      <TraineeManagementList
        trainees={trainees}
        assignments={assignments}
        woCounts={woCounts}
        loading={loading || traineesLoading}
        onViewOffboardReport={(assignment) => setReportAssignment(assignment)}
      />

      <ModuleLibrarySection />

      {reportAssignment && (
        <OffboardTrainingReportViewer
          assignment={reportAssignment}
          onClose={() => setReportAssignment(null)}
        />
      )}
    </div>
  );
}
