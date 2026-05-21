import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { CheckCircle2, Circle } from 'lucide-react';

interface PMTask {
  id: string;
  machineName: string;
  pmType: string;
  scheduledTime: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TodaysPmListProps {
  technicianId: string;
  siteId: string;
}

export default function TodaysPmList({ technicianId, siteId }: TodaysPmListProps) {
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      if (!siteId) {
        setLoading(false);
        return;
      }
      // Query pm_schedules or pm_history for today's tasks
      const q = query(
        collection(db, 'pm_schedules'),
        where('siteId', '==', siteId),
        where('assignedTechnicianIds', 'array-contains', technicianId),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({
        id: d.id,
        machineName: d.data().machineName || 'Unknown',
        pmType: d.data().scheduleType || 'Routine',
        scheduledTime: d.data().nextDueDate?.toDate?.().toLocaleTimeString?.() ?? '09:00',
        status: 'pending' as const,
      }));
      setTasks(data);
      setLoading(false);
    }
    fetch();
  }, [technicianId, siteId]);

  return (
    <DashboardWidget title="Today's PM Schedule" loading={loading}>
      {tasks.length === 0 ? (
        <EmptyState message="No PMs scheduled today" />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
            >
              {task.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[#8BA3BF] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{task.machineName}</p>
                <p className="text-[11px] text-[#8BA3BF]">{task.pmType}</p>
              </div>
              <span className="text-xs text-[#8BA3BF] shrink-0">{task.scheduledTime}</span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
