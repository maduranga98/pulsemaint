import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays, UserPlus } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { SAFETY_TRAINING_TYPE, type TrainingModule } from '@/lib/training/trainingTypes';
import ModuleAssignForm from '@/components/training/manager/ModuleAssignForm';

// Roles that can assign safety trainings to people from this schedule.
const CAN_ASSIGN_ROLES = ['safety_officer', 'supervisor', 'plant_manager', 'admin'];

// Roles the Firestore rules let list every company assignment. Everyone else
// can only read their own (`traineeId == auth.uid`) — querying the full
// collection as one of those roles is a `permission-denied`, which the
// `onSnapshot` error callback below turns into an empty list. That happens
// on every listener attach, so the calendar would flash "no trainings
// scheduled" a moment after briefly showing (or never show) — hence the
// role-aware query: non-management roles fetch only their own assignments,
// which the rules always allow, instead of the company-wide one.
const CAN_LIST_ALL_ASSIGNMENTS_ROLES = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'hr_officer', 'admin', 'safety_officer'];

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
function useSafetyTrainingSchedule(companyId: string, userId: string, role: string | undefined): {
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
  // Management roles can list every assignment in the company; everyone else
  // is restricted by the security rules to their own, so they query by
  // `traineeId` instead — a company-wide query for those roles would be
  // denied outright and never show anything.
  const canListAll = !!role && CAN_LIST_ALL_ASSIGNMENTS_ROLES.includes(role);
  useEffect(() => {
    if (!companyId || (!canListAll && !userId)) return;
    const constraints = canListAll
      ? [where('companyId', '==', companyId)]
      : [where('companyId', '==', companyId), where('traineeId', '==', userId)];
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), ...constraints),
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
  }, [companyId, userId, canListAll, safetyModuleIds]);

  const lessons = useMemo(() => [...moduleLessons, ...assignmentEntries], [moduleLessons, assignmentEntries]);
  return useMemo(() => ({ lessons, modulesById }), [lessons, modulesById]);
}

export default function SafetyCalendarPage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const role = useAuthStore((s) => s.userProfile?.role);
  const canAssign = !!role && CAN_ASSIGN_ROLES.includes(role);
  const { lessons, modulesById } = useSafetyTrainingSchedule(companyId, userId, role);
  const [assigningModule, setAssigningModule] = useState<TrainingModule | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthLabel = cursor.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const today = ymd(new Date());

  const lessonsByDay = useMemo(() => {
    const m = new Map<string, ScheduledLesson[]>();
    lessons.forEach((l) => { m.set(l.date, [...(m.get(l.date) ?? []), l]); });
    return m;
  }, [lessons]);

  const selectedLessons = selectedDate ? lessonsByDay.get(selectedDate) ?? [] : [];

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
      <button
        type="button"
        onClick={() => navigate('/app/training/manage/safety-trainings')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#8BA3BF] hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Safety Trainings
      </button>

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

      <div className="grid grid-cols-7 gap-1.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-semibold text-[#8BA3BF]">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const dayLessons = lessonsByDay.get(date) ?? [];
          const isToday = date === today;
          const isSelected = date === selectedDate;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`min-h-[84px] rounded-lg border p-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-[#5B8DEF] bg-[#5B8DEF]/20 ring-2 ring-inset ring-[#5B8DEF]'
                  : isToday
                  ? 'border-[#1A56DB] bg-[#1A56DB]/10 hover:bg-[#1A56DB]/20'
                  : 'border-[#1E3A5F] bg-[#0F1E35] hover:bg-[#15233c]'
              }`}
            >
              <div className="text-xs font-semibold text-[#8BA3BF]">{Number(date.slice(8, 10))}</div>
              <div className="mt-1 space-y-1">
                {dayLessons.slice(0, 3).map((l, idx) => (
                  <div key={idx} className="truncate rounded bg-[#5B8DEF]/15 px-1 py-0.5 text-[10px] text-[#5B8DEF]">
                    {l.moduleTitle}
                  </div>
                ))}
                {dayLessons.length > 3 && <div className="text-[10px] text-[#8BA3BF]">+{dayLessons.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day's sessions — click a day above to view it here. */}
      {selectedDate && (
        <div className="mt-5 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#F0F4F8]">
            {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </h2>
          {selectedLessons.length === 0 ? (
            <p className="text-sm text-[#8BA3BF]">No safety trainings scheduled this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedLessons.map((l, idx) => {
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
                      {l.time || l.lessonTitle
                        ? [l.time, l.lessonTitle].filter(Boolean).join(' · ')
                        : 'No time set'}
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
