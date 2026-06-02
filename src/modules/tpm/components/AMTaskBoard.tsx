import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, CheckSquare, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useAMTasks } from '../hooks/useTPM';
import { updateAMTask } from '../services/tpm.service';
import type { AMTask, AMTaskShift } from '../types/tpm.types';

// ─── Compliance Gauge ─────────────────────────────────────────────────────────

function ComplianceGauge({ compliance, done, total }: { compliance: number; done: number; total: number }) {
  const color =
    compliance >= 90 ? 'text-emerald-400' : compliance >= 70 ? 'text-amber-400' : 'text-red-400';
  const bg =
    compliance >= 90 ? 'bg-emerald-500' : compliance >= 70 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
          AM Compliance
        </p>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${bg} rounded-full transition-all duration-700`}
            style={{ width: `${compliance}%` }}
          />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-2xl font-bold font-sora ${color}`}>{compliance}%</p>
        <p className="text-xs text-slate-500">
          {done} / {total} tasks
        </p>
      </div>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: AMTask;
  onComplete: (taskId: string) => void;
  isUpdating: boolean;
}

const FREQ_COLORS: Record<string, string> = {
  daily: 'bg-blue-900/50 text-blue-400 border-blue-800',
  weekly: 'bg-purple-900/50 text-purple-400 border-purple-800',
  monthly: 'bg-slate-700 text-slate-300 border-slate-600',
};

function TaskRow({ task, onComplete, isUpdating }: TaskRowProps) {
  const isOverdue = task.status === 'overdue';
  const isDone = task.status === 'done';

  return (
    <div
      className={`flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors ${
        isOverdue ? 'bg-red-900/10 border border-red-800/40' : 'hover:bg-slate-700/30'
      } ${isDone ? 'opacity-60' : ''}`}
    >
      <button
        onClick={() => !isDone && onComplete(task.id)}
        disabled={isDone || isUpdating}
        className={`flex-shrink-0 mt-0.5 h-4 w-4 rounded border transition-colors
          ${isDone ? 'bg-emerald-600 border-emerald-600' : 'border-slate-500 hover:border-blue-400'}
          ${isUpdating ? 'opacity-50' : ''}`}
        aria-label="Mark task as done"
      >
        {isDone && (
          <svg className="h-full w-full p-0.5 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-tight ${
            isDone ? 'line-through text-slate-500' : isOverdue ? 'text-red-300' : 'text-white'
          }`}
        >
          {task.taskDescription}
        </p>
        {task.assignedTo && (
          <p className="text-[11px] text-slate-500 mt-0.5">Assigned: {task.assignedTo}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
            FREQ_COLORS[task.frequency] ?? FREQ_COLORS.daily
          }`}
        >
          {task.frequency}
        </span>
        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
      </div>
    </div>
  );
}

// ─── Machine Group ────────────────────────────────────────────────────────────

interface MachineGroupProps {
  machineId: string;
  machineName: string;
  tasks: AMTask[];
  onComplete: (taskId: string) => void;
  onBulkComplete: (machineId: string) => void;
  updatingIds: Set<string>;
}

function MachineGroup({
  machineId,
  machineName,
  tasks,
  onComplete,
  onBulkComplete,
  updatingIds,
}: MachineGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const done = tasks.filter((t) => t.status === 'done').length;
  const total = tasks.length;
  const allDone = done === total;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Machine Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          <span className="text-sm font-semibold text-white">{machineName}</span>
          <span className="text-xs text-slate-500">{machineId}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${allDone ? 'text-emerald-400' : 'text-slate-400'}`}>
            {done}/{total}
          </span>
          {!allDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBulkComplete(machineId);
              }}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-800/50 hover:bg-blue-900/20 transition-colors"
            >
              <CheckSquare className="h-3 w-3" />
              Complete All
            </button>
          )}
        </div>
      </button>

      {/* Tasks */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={onComplete}
              isUpdating={updatingIds.has(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyTaskState({ date }: { date: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <span className="text-5xl">📋</span>
      <div className="text-center">
        <p className="text-base font-semibold text-slate-300">No AM Tasks for {date}</p>
        <p className="text-sm text-slate-500 mt-1">
          No autonomous maintenance tasks scheduled for this shift.
        </p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AMTaskSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-14 bg-slate-800/60 rounded-xl" />
      {[1, 2].map((i) => (
        <div key={i} className="bg-slate-800/60 rounded-xl p-4 space-y-2.5">
          <div className="h-4 w-32 bg-slate-700 rounded" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-8 bg-slate-700/60 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function AMTaskBoard() {
  const userId = useAuthStore((s) => s.userProfile?.id);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const canInput = useAuthStore((s) =>
    s.canAccess(['supervisor', 'admin'])
  );

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedShift, setSelectedShift] = useState<AMTaskShift>('day');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const { grouped, overdue, compliance, loading, error } = useAMTasks(selectedDate, selectedShift);
  const allTasks = useMemo(() => grouped.flatMap((g) => g.tasks), [grouped]);

  const handleComplete = async (taskId: string) => {
    if (!companyId || !canInput) return;
    setUpdatingIds((prev) => new Set(prev).add(taskId));
    try {
      await updateAMTask(companyId, taskId, 'done', userId ?? null);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleBulkComplete = async (machineId: string) => {
    if (!companyId || !canInput) return;
    const group = grouped.find((g) => g.machineId === machineId);
    if (!group) return;
    const pending = group.tasks.filter((t) => t.status !== 'done');
    await Promise.all(pending.map((t) => handleComplete(t.id)));
  };

  const shifts: { value: AMTaskShift; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'evening', label: 'Evening' },
    { value: 'night', label: 'Night' },
  ];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <div className="flex rounded-lg border border-slate-700 overflow-hidden">
          {shifts.map((s) => (
            <button
              key={s.value}
              onClick={() => setSelectedShift(s.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedShift === s.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {!canInput && (
          <span className="text-xs text-slate-500 italic">View only — insufficient permissions to update tasks</span>
        )}
      </div>

      {/* Compliance Gauge */}
      {!loading && allTasks.length > 0 && (
        <ComplianceGauge
          compliance={compliance}
          done={allTasks.filter((t) => t.status === 'done').length}
          total={allTasks.length}
        />
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <AMTaskSkeleton />}

      {/* Overdue Section */}
      {!loading && overdue.length > 0 && (
        <div className="bg-red-900/10 border border-red-800/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-red-800/40">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold text-red-400">
              {overdue.length} Overdue Task{overdue.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="px-3 py-2 space-y-1">
            {overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={handleComplete}
                isUpdating={updatingIds.has(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Task Groups */}
      {!loading && grouped.length === 0 && !error && (
        <EmptyTaskState date={selectedDate} />
      )}

      {!loading &&
        grouped.map((group) => (
          <MachineGroup
            key={group.machineId}
            machineId={group.machineId}
            machineName={group.machineName}
            tasks={group.tasks}
            onComplete={handleComplete}
            onBulkComplete={handleBulkComplete}
            updatingIds={updatingIds}
          />
        ))}
    </div>
  );
}
