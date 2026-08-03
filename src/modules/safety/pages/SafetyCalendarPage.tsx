import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, GraduationCap, UserPlus } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { SAFETY_TRAINING_TYPE, type TrainingModule } from '@/lib/training/trainingTypes';
import ModuleAssignForm from '@/components/training/manager/ModuleAssignForm';

// Roles that can assign safety trainings to people from this schedule.
const CAN_ASSIGN_ROLES = ['safety_officer', 'supervisor', 'plant_manager', 'admin'];

interface ScheduledLesson {
  date: string;
  time: string;
  moduleId?: string;
  moduleTitle: string;
  lessonTitle: string;
  // Only set for assignment-derived entries — every person this training was
  // assigned to on this date, so multiple assignees collapse into one entry
  // instead of one row per person.
  assignees?: string[];
}

function ymd(d: Date): string {
  // Format in local time. `toISOString()` converts to UTC first, which shifts
  // the calendar day by one in any timezone west of UTC — the grid cells (built
  // from local `new Date(y, m, d)`) then failed to line up with lesson dates and
  // "today" highlighting landed on the wrong cell.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tsToYmd(ts: unknown): string | null {
  const d = (ts as { toDate?: () => Date; seconds?: number } | null | undefined);
  if (!d) return null;
  if (typeof d.toDate === 'function') return ymd(d.toDate());
  if (typeof d.seconds === 'number') return ymd(new Date(d.seconds * 1000));
  return null;
}

/**
 * The safety-training schedule shown on this page. It combines two sources so
 * every safety training surfaces here:
 *  - Scheduled lessons of "Safety Training" modules (lessons with a date).
 *  - Safety-training *assignments* made from the Training tab — placed on the
 *    assignment's due date (or the day it was assigned) so an assigned safety
 *    training shows even when its module lessons carry no per-lesson schedule.
 */
function useSafetyTrainingSchedule(companyId: string): {
  lessons: ScheduledLesson[];
  modulesById: Map<string, TrainingModule>;
} {
  const [moduleLessons, setModuleLessons] = useState<ScheduledLesson[]>([]);
  const [safetyModuleIds, setSafetyModuleIds] = useState<Set<string>>(new Set());
  const [modulesById, setModulesById] = useState<Map<string, TrainingModule>>(new Map());
  const [assignmentEntries, setAssignmentEntries] = useState<ScheduledLesson[]>([]);

  // Safety-training modules: their scheduled lessons + the set of safety module ids.
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
      (snap) => {
        const out: ScheduledLesson[] = [];
        const ids = new Set<string>();
        const byId = new Map<string, TrainingModule>();
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.trainingType !== SAFETY_TRAINING_TYPE) return; // safety training only
          ids.add(d.id);
          byId.set(d.id, { id: d.id, ...data } as TrainingModule);
          const moduleTitle = String(data.title ?? 'Safety Training');
          const ls = (data.lessons ?? []) as Array<{ title?: string; scheduledDate?: string; scheduledTime?: string }>;
          ls.forEach((l) => {
            if (l.scheduledDate) {
              out.push({
                date: l.scheduledDate,
                time: String(l.scheduledTime ?? ''),
                moduleId: d.id,
                moduleTitle,
                lessonTitle: String(l.title ?? ''),
              });
            }
          });
        });
        setModuleLessons(out);
        setSafetyModuleIds(ids);
        setModulesById(byId);
      },
      () => { setModuleLessons([]); setSafetyModuleIds(new Set()); setModulesById(new Map()); },
    );
    return () => unsub();
  }, [companyId]);

  // Safety-training assignments — placed on their due date (or assigned date).
  // A denied read (roles that can't list all company assignments) just yields
  // nothing here, leaving the module schedule intact.
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        // One entry per (module, date) — every assignee collapses into that
        // entry's `assignees` list rather than producing a duplicate row.
        const grouped = new Map<string, ScheduledLesson>();
        snap.docs.forEach((d) => {
          const a = d.data();
          const isSafety = a.trainingType === SAFETY_TRAINING_TYPE || safetyModuleIds.has(String(a.moduleId));
          if (!isSafety) return;
          const date = tsToYmd(a.dueDate) ?? tsToYmd(a.assignedAt);
          if (!date) return;
          const moduleTitle = String(a.moduleName ?? 'Safety Training');
          const key = `${a.moduleId ?? moduleTitle}|${date}`;
          const traineeName = a.traineeName ? String(a.traineeName) : null;
          const existing = grouped.get(key);
          if (existing) {
            if (traineeName && !existing.assignees?.includes(traineeName)) {
              existing.assignees = [...(existing.assignees ?? []), traineeName];
            }
          } else {
            grouped.set(key, {
              date,
              time: '',
              moduleId: a.moduleId ? String(a.moduleId) : undefined,
              moduleTitle,
              lessonTitle: '',
              assignees: traineeName ? [traineeName] : [],
            });
          }
        });
        setAssignmentEntries([...grouped.values()]);
      },
      () => setAssignmentEntries([]),
    );
    return () => unsub();
  }, [companyId, safetyModuleIds]);

  const lessons = useMemo(() => [...moduleLessons, ...assignmentEntries], [moduleLessons, assignmentEntries]);
  return useMemo(() => ({ lessons, modulesById }), [lessons, modulesById]);
}

export default function SafetyCalendarPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const role = useAuthStore((s) => s.userProfile?.role);
  const canAssign = !!role && CAN_ASSIGN_ROLES.includes(role);
  const { lessons, modulesById } = useSafetyTrainingSchedule(companyId);
  const [assigningModule, setAssigningModule] = useState<TrainingModule | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const monthLabel = cursor.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const today = ymd(new Date());

  const lessonsByDay = useMemo(() => {
    const m = new Map<string, ScheduledLesson[]>();
    lessons.forEach((l) => { m.set(l.date, [...(m.get(l.date) ?? []), l]); });
    return m;
  }, [lessons]);

  // Upcoming safety trainings (today onward), soonest first.
  const upcoming = useMemo(
    () => [...lessons].filter((l) => l.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    [lessons, today],
  );

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startPad = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(ymd(new Date(year, month, d)));
    return arr;
  }, [cursor]);

  return (
    <div className="min-h-full bg-[#0A1628] p-4 text-[#F0F4F8] sm:p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-[Sora] text-xl font-bold">
          <CalendarDays className="h-5 w-5 text-[#5B8DEF]" /> Safety Training Schedules
        </h1>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="rounded-lg border border-[#1E3A5F] p-1.5 text-[#8BA3BF] hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[160px] text-center text-sm font-semibold">{monthLabel}</span>
          <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="rounded-lg border border-[#1E3A5F] p-1.5 text-[#8BA3BF] hover:text-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <p className="mb-3 flex items-center gap-1.5 text-xs text-[#8BA3BF]">
        <span className="h-2 w-2 rounded-full bg-[#5B8DEF]" /> Assigned safety training sessions (Training Type “Safety Training”)
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="grid grid-cols-7 gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="pb-1 text-center text-xs font-semibold text-[#8BA3BF]">{d}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const dayLessons = lessonsByDay.get(date) ?? [];
              const isToday = date === today;
              return (
                <div key={i} className={`min-h-[84px] rounded-lg border p-1.5 ${isToday ? 'border-[#1A56DB] bg-[#1A56DB]/10' : 'border-[#1E3A5F] bg-[#0F1E35]'}`}>
                  <div className="text-xs font-semibold text-[#8BA3BF]">{Number(date.slice(8, 10))}</div>
                  <div className="mt-1 space-y-1">
                    {dayLessons.slice(0, 3).map((l, idx) => {
                      const detail = l.lessonTitle || (l.assignees?.length ? `Assigned to ${l.assignees.join(', ')}` : '');
                      return (
                        <div key={idx} className="truncate rounded bg-[#5B8DEF]/15 px-1 py-0.5 text-[10px] text-[#5B8DEF]" title={`${l.moduleTitle}${detail ? ': ' + detail : ''}`}>
                          {l.moduleTitle}
                        </div>
                      );
                    })}
                    {dayLessons.length > 3 && <div className="text-[10px] text-[#8BA3BF]">+{dayLessons.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming assigned safety trainings, by module name */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F0F4F8]">
              <GraduationCap className="h-4 w-4 text-[#5B8DEF]" /> Upcoming Safety Trainings
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[#8BA3BF]">No safety trainings scheduled. Create a module with Training Type “Safety Training” and schedule its lessons.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((l, idx) => {
                  const module = l.moduleId ? modulesById.get(l.moduleId) : undefined;
                  return (
                    <div key={idx} className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-[#F0F4F8]">{l.moduleTitle}</p>
                        {canAssign && module && (
                          <button
                            type="button"
                            onClick={() => setAssigningModule(module)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#1E3A5F] px-2 py-1 text-[11px] font-medium text-[#5B8DEF] hover:bg-[#5B8DEF]/10"
                          >
                            <UserPlus className="h-3 w-3" /> Assign
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#8BA3BF]">
                        {new Date(l.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {l.time ? ` · ${l.time}` : ''}
                        {l.lessonTitle ? ` · ${l.lessonTitle}` : ''}
                      </p>
                      {l.assignees && l.assignees.length > 0 && (
                        <p className="mt-1 text-xs text-[#5B8DEF]">
                          Assigned to {l.assignees.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
