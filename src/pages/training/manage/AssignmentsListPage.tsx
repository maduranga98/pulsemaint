import { useState, useEffect, useMemo } from 'react';
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
import { useTraineeLibraryModules } from '@/hooks/training/useTraineeLibraryModules';
import { useTraineeWorkOrderCounts } from '@/hooks/training/useTraineeWorkOrderCounts';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import TraineeManagementList from '@/components/training/manager/TraineeManagementList';
import TraineeModuleLibrary from '@/components/training/manager/library/TraineeModuleLibrary';
import OffboardTrainingReportViewer from '@/components/training/manager/OffboardTrainingReportViewer';

export default function AssignmentsListPage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [allAssignments, setAllAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportAssignment, setReportAssignment] = useState<TrainingAssignment | null>(null);

  const { trainees, loading: traineesLoading } = useTraineeList();
  const { counts: woCounts } = useTraineeWorkOrderCounts();
  // Trainee Management only reports on its own library's modules — an
  // assignment made from the Training tab's library never appears here,
  // even when it happens to target a trainee.
  const { modules: traineeModules, loading: modulesLoading } = useTraineeLibraryModules();

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const q = query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId));

    const unsub = onSnapshot(q, (snap) => {
      setAllAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment)));
      setLoading(false);
    });

    return () => unsub();
  }, [companyId]);

  const assignments = useMemo(() => {
    const traineeModuleIds = new Set(traineeModules.map((m) => m.id));
    // Trainee Management tracks trainee-role assignments made from its own
    // module library. Legacy assignments made before traineeRole was
    // recorded, and anything assigned out of the Training tab, are excluded.
    return allAssignments.filter((a) => a.traineeRole === 'trainee' && traineeModuleIds.has(a.moduleId));
  }, [allAssignments, traineeModules]);

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
        loading={loading || traineesLoading || modulesLoading}
        onViewOffboardReport={(assignment) => setReportAssignment(assignment)}
      />

      <TraineeModuleLibrary />

      {reportAssignment && (
        <OffboardTrainingReportViewer
          assignment={reportAssignment}
          onClose={() => setReportAssignment(null)}
        />
      )}
    </div>
  );
}
