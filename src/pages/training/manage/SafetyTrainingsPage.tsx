import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert, CalendarClock, Users, UserPlus, Plus, CalendarDays, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import {
  getModuleSessions,
  useCompanySafetyAssignments,
  useSafetyTrainingModules,
} from '@/hooks/training/useSafetyTrainings';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import ModuleAssignForm from '@/components/training/manager/ModuleAssignForm';
import type { Timestamp } from 'firebase/firestore';
import type { TrainingAssignment, TrainingModule } from '@/lib/training/trainingTypes';

function formatTimestamp(ts: Timestamp | null | undefined): string {
  const d = (ts as { toDate?: () => Date } | null | undefined)?.toDate?.();
  if (!d) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Admin / Plant Manager view of every Safety Training in the company: each
 * safety module, its scheduled sessions, and who it's assigned to with the
 * time each assignment was made.
 */
export default function SafetyTrainingsPage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  // Delete is admin-only (see firestore.rules trainingModules delete rule) —
  // other authoring roles (plant_manager/supervisor/hr_officer/safety_officer)
  // can edit/assign but would hit a permission-denied write on delete.
  const isAdmin = useAuthStore((s) => s.userProfile?.role === 'admin');
  const { modules, moduleIds, loading: modulesLoading } = useSafetyTrainingModules(companyId);
  const { assignments, loading: assignmentsLoading } = useCompanySafetyAssignments(companyId, moduleIds);
  const [assigningModule, setAssigningModule] = useState<TrainingModule | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(moduleId: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(moduleId);
    try {
      await deleteDoc(doc(db, 'trainingModules', moduleId));
      toast.success('Safety training module deleted.');
    } catch (err) {
      console.error('Failed to delete safety training module', err);
      toast.error('Failed to delete module. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  const assignmentsByModule = useMemo(() => {
    const m = new Map<string, TrainingAssignment[]>();
    for (const a of assignments) {
      m.set(a.moduleId, [...(m.get(a.moduleId) ?? []), a]);
    }
    return m;
  }, [assignments]);

  // Modules the assignments reference but that aren't in the safety-module list
  // (e.g. an assignment tagged safety whose module was archived) still get a row
  // keyed by the assignment's module name.
  const orphanModuleIds = useMemo(
    () => [...assignmentsByModule.keys()].filter((id) => !moduleIds.has(id)),
    [assignmentsByModule, moduleIds],
  );

  const modulesById = useMemo(() => {
    const m = new Map<string, TrainingModule>();
    for (const mod of modules) m.set(mod.id, mod);
    return m;
  }, [modules]);

  const loading = modulesLoading || assignmentsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  const totalAssignees = new Set(assignments.map((a) => a.traineeId)).size;

  const moduleRows = [
    ...modules.map((m) => ({ id: m.id, title: m.title, sessions: getModuleSessions(m) })),
    ...orphanModuleIds.map((id) => ({
      id,
      title: assignmentsByModule.get(id)?.[0]?.moduleName ?? 'Safety Training',
      sessions: [] as ReturnType<typeof getModuleSessions>,
    })),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
          <h1 className="text-xl font-bold text-slate-900">Safety Trainings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/app/safety/calendar')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" /> View Training Schedules
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/training/manage/safety-trainings/new')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" /> Create Safety Training Module
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{modules.length}</div>
          <div className="text-xs text-slate-500">Safety modules</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{assignments.length}</div>
          <div className="text-xs text-slate-500">Assignments</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{totalAssignees}</div>
          <div className="text-xs text-slate-500">People assigned</div>
        </div>
      </div>

      {moduleRows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          No safety trainings yet. Use "Create Safety Training Module" above, then assign it.
        </div>
      ) : (
        <div className="space-y-5">
          {moduleRows.map((row) => {
            const rowAssignments = assignmentsByModule.get(row.id) ?? [];
            const isExpanded = expandedModuleId === row.id;
            return (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedModuleId((cur) => (cur === row.id ? null : row.id))}
                    className="inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-amber-700"
                  >
                    {row.title}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Users className="h-3.5 w-3.5" /> {rowAssignments.length} assigned
                    </span>
                    {modulesById.has(row.id) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAssigningModule(modulesById.get(row.id) ?? null)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Assign
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/app/training/manage/modules/${row.id}`)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => handleDelete(row.id, row.title)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {row.sessions.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {row.sessions.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700"
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDate(s.date)}
                            {s.time ? ` · ${s.time}` : ''}
                            {s.lessonTitle ? ` · ${s.lessonTitle}` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {rowAssignments.length === 0 ? (
                      <p className="text-sm text-slate-500">Not assigned to anyone yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                              <th className="py-2 pr-3 font-medium">Attendee</th>
                              <th className="py-2 pr-3 font-medium">Assigned by</th>
                              <th className="py-2 pr-3 font-medium">Assigned at</th>
                              <th className="py-2 pr-3 font-medium">Completion status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rowAssignments.map((a) => (
                              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                                <td className="py-2 pr-3">
                                  <span className="font-medium text-slate-800">{a.traineeName}</span>
                                  {a.department ? (
                                    <span className="block text-xs text-slate-400">{a.department}</span>
                                  ) : null}
                                </td>
                                <td className="py-2 pr-3 text-slate-600">{a.assignedByName || '—'}</td>
                                <td className="py-2 pr-3 text-slate-600">{formatTimestamp(a.assignedAt)}</td>
                                <td className="py-2 pr-3">
                                  <TrainingStatusBadge status={a.status} />
                                  {a.completedAt && (
                                    <span className="block text-xs text-slate-400 mt-0.5">
                                      Completed {formatTimestamp(a.completedAt)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assigningModule && (
        <ModuleAssignForm
          module={assigningModule}
          onClose={() => setAssigningModule(null)}
          onAssigned={() => setAssigningModule(null)}
        />
      )}
    </div>
  );
}
