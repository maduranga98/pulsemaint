import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingAssignment, AssignmentStatus } from '@/lib/training/trainingTypes';
import AssignmentsList from '@/components/training/manager/AssignmentsList';

const STATUS_OPTIONS: { label: string; value: AssignmentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Not Started', value: 'not_started' },
  { label: 'Awaiting Sign-Off', value: 'awaiting_practical' },
  { label: 'Overdue', value: 'expired' },
  { label: 'Certified', value: 'certified' },
  { label: 'Retraining', value: 'retraining_required' },
];

export default function AssignmentsListPage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const constraints = [where('companyId', '==', companyId)];
    if (statusFilter !== 'all') {
      constraints.push(where('status', '==', statusFilter));
    }
    const q = query(collection(db, 'trainingAssignments'), ...constraints);

    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment)));
      setLoading(false);
    });

    return () => unsub();
  }, [companyId, statusFilter]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Assignments</h1>
        <button
          onClick={() => navigate('/app/training/manage/assign')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Assign Training
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <AssignmentsList
        assignments={assignments}
        loading={loading}
        onViewProgress={(id) => navigate(`/app/training/manage/trainees/${id}`)}
      />
    </div>
  );
}
