import { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import { AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { useShiftConfig } from '../../hooks/useShiftConfig';
import { useSchedulableJobs } from '../../hooks/pm/useSchedulableJobs';
import { useCompanyTechnicians } from '../../hooks/pm/useCompanyTechnicians';
import { reassignJobTechnician } from '../../services/scheduler.service';
import {
  shiftCapacityHours,
  detectConflict,
  isSameDay,
  type SchedulableJob,
} from '../../lib/pm/schedulerConflict';

const PRIORITY_BORDER: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#94A3B8',
};

const UNASSIGNED = '__unassigned__';

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface PendingDrop {
  job: SchedulableJob;
  technicianId: string;
  technicianName: string;
  totalHours: number;
  capacityHours: number;
  conflictingTitles: string[];
}

export function SchedulerBoard() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { jobs, loading } = useSchedulableJobs(companyId);
  const { technicians } = useCompanyTechnicians(companyId);
  const { shifts } = useShiftConfig();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);

  const capacityHours = useMemo(() => shiftCapacityHours(shifts), [shifts]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Jobs scheduled on the selected day.
  const dayJobs = useMemo(
    () => jobs.filter((j) => isSameDay(j.date, selectedDate)),
    [jobs, selectedDate],
  );

  // Group jobs by technician column (a job appears under each assigned tech).
  const columns = useMemo(() => {
    const map = new Map<string, SchedulableJob[]>();
    map.set(UNASSIGNED, []);
    technicians.forEach((t) => map.set(t.id, []));

    for (const job of dayJobs) {
      if (job.assignedTechnicianIds.length === 0) {
        map.get(UNASSIGNED)!.push(job);
      } else {
        job.assignedTechnicianIds.forEach((tid) => {
          if (!map.has(tid)) map.set(tid, []);
          map.get(tid)!.push(job);
        });
      }
    }
    return map;
  }, [dayJobs, technicians]);

  const performReassign = useCallback(
    async (job: SchedulableJob, technicianId: string, technicianName: string) => {
      try {
        await reassignJobTechnician(job, technicianId, technicianName);
        toast.success(
          technicianId
            ? `Reassigned “${job.title}” to ${technicianName}`
            : `Unassigned “${job.title}”`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to reassign job');
      }
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveJobId(null);
      const { active, over } = event;
      if (!over) return;

      const jobId = active.id as string;
      const targetTechId = over.id as string;
      const job = dayJobs.find((j) => j.id === jobId);
      if (!job) return;

      // No-op if already solely assigned to that column's tech.
      if (targetTechId === UNASSIGNED) {
        if (job.assignedTechnicianIds.length === 0) return;
        void performReassign(job, '', '');
        return;
      }
      if (job.assignedTechnicianIds.length === 1 && job.assignedTechnicianIds[0] === targetTechId) {
        return;
      }

      const tech = technicians.find((t) => t.id === targetTechId);
      if (!tech) return;

      // Re-run the conflict check for the target technician on this day.
      const conflict = detectConflict({
        technicianId: targetTechId,
        date: job.date,
        addedHours: job.estimatedHours,
        existingJobs: dayJobs,
        capacityHours,
        excludeJobId: job.id,
      });

      if (conflict.isDoubleBooked) {
        setPendingDrop({
          job,
          technicianId: targetTechId,
          technicianName: tech.name,
          totalHours: conflict.totalHours,
          capacityHours: conflict.capacityHours,
          conflictingTitles: conflict.conflictingJobs.map((j) => j.title),
        });
        return;
      }

      void performReassign(job, targetTechId, tech.name);
    },
    [dayJobs, technicians, capacityHours, performReassign],
  );

  const activeJob = activeJobId ? dayJobs.find((j) => j.id === activeJobId) : null;

  const shiftStep = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftStep(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">←</button>
          <input
            type="date"
            value={toISODate(selectedDate)}
            onChange={(e) => e.target.value && setSelectedDate(new Date(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <button onClick={() => shiftStep(1)} className="p-1.5 hover:bg-gray-100 rounded-lg">→</button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          Shift capacity: {capacityHours}h / technician — drag a job onto a technician to reassign.
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading scheduler…</div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setActiveJobId(e.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            <TechColumn
              id={UNASSIGNED}
              title="Unassigned"
              jobs={columns.get(UNASSIGNED) ?? []}
              capacityHours={capacityHours}
              isUnassigned
            />
            {technicians.map((t) => (
              <TechColumn
                key={t.id}
                id={t.id}
                title={t.name}
                jobs={columns.get(t.id) ?? []}
                capacityHours={capacityHours}
              />
            ))}
            {technicians.length === 0 && (
              <div className="text-sm text-gray-400 p-4">No technicians found for this company.</div>
            )}
          </div>

          <DragOverlay>{activeJob ? <JobCard job={activeJob} dragging /> : null}</DragOverlay>
        </DndContext>
      )}

      {pendingDrop && (
        <ConfirmDoubleBookModal
          pending={pendingDrop}
          onCancel={() => setPendingDrop(null)}
          onConfirm={() => {
            void performReassign(pendingDrop.job, pendingDrop.technicianId, pendingDrop.technicianName);
            setPendingDrop(null);
          }}
        />
      )}
    </div>
  );
}

function TechColumn({
  id,
  title,
  jobs,
  capacityHours,
  isUnassigned = false,
}: {
  id: string;
  title: string;
  jobs: SchedulableJob[];
  capacityHours: number;
  isUnassigned?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const bookedHours = isUnassigned ? 0 : jobs.reduce((s, j) => s + j.estimatedHours, 0);
  const overbooked = !isUnassigned && bookedHours > capacityHours;
  const pct = capacityHours > 0 ? Math.min(100, (bookedHours / capacityHours) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      className={`w-60 flex-shrink-0 rounded-xl border ${
        overbooked ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-50'
      } ${isOver ? 'ring-2 ring-blue-400' : ''}`}
    >
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
          {overbooked && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 uppercase">
              <AlertTriangle className="w-3 h-3" /> Double-booked
            </span>
          )}
        </div>
        {!isUnassigned && (
          <>
            <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${overbooked ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className={`mt-0.5 text-[11px] ${overbooked ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {bookedHours}h / {capacityHours}h
            </p>
          </>
        )}
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        {jobs.length === 0 ? (
          <p className="text-xs text-gray-300 text-center py-4">Drop jobs here</p>
        ) : (
          jobs.map((job) => <DraggableJob key={`${id}-${job.id}`} job={job} />)
        )}
      </div>
    </div>
  );
}

function DraggableJob({ job }: { job: SchedulableJob }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <JobCard job={job} />
    </div>
  );
}

function JobCard({ job, dragging = false }: { job: SchedulableJob; dragging?: boolean }) {
  return (
    <div
      className={`rounded-lg bg-white border border-gray-200 p-2 text-left ${dragging ? 'shadow-lg' : 'shadow-sm'}`}
      style={{ borderLeft: `3px solid ${PRIORITY_BORDER[job.priority] ?? '#94A3B8'}` }}
    >
      <p className="text-xs font-medium text-gray-900 truncate">{job.title}</p>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-gray-400 truncate">{job.machineName}</span>
        <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap ml-1">
          {job.estimatedHours}h
        </span>
      </div>
    </div>
  );
}

function ConfirmDoubleBookModal({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingDrop;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
        <div className="flex items-start gap-3 border-b border-gray-200 px-6 py-4">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Technician double-booked</h3>
            <p className="text-xs text-gray-500">
              {pending.technicianName} would be booked {pending.totalHours}h on this day, exceeding
              the {pending.capacityHours}h shift capacity.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-gray-700">
          <p className="mb-1 font-medium">Already scheduled that day:</p>
          <ul className="list-disc pl-5 space-y-0.5 text-gray-600">
            {pending.conflictingTitles.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-200 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm"
          >
            Assign anyway
          </button>
        </div>
      </div>
    </div>
  );
}
