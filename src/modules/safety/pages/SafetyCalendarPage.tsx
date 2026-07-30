import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, GraduationCap } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { SAFETY_TRAINING_TYPE } from '@/lib/training/trainingTypes';

interface ScheduledLesson {
  date: string;
  time: string;
  moduleTitle: string;
  lessonTitle: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Scheduled lessons that belong to a *safety training* module — a module whose
 * Training Type is "Safety Training". Assigning such a module surfaces its
 * scheduled sessions here.
 */
function useSafetyTrainingSchedule(companyId: string): ScheduledLesson[] {
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
      (snap) => {
        const out: ScheduledLesson[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.trainingType !== SAFETY_TRAINING_TYPE) return; // safety training only
          const moduleTitle = String(data.title ?? 'Safety Training');
          const ls = (data.lessons ?? []) as Array<{ title?: string; scheduledDate?: string; scheduledTime?: string }>;
          ls.forEach((l) => {
            if (l.scheduledDate) {
              out.push({
                date: l.scheduledDate,
                time: String(l.scheduledTime ?? ''),
                moduleTitle,
                lessonTitle: String(l.title ?? ''),
              });
            }
          });
        });
        setLessons(out);
      },
      () => setLessons([]),
    );
    return () => unsub();
  }, [companyId]);
  return lessons;
}

export default function SafetyCalendarPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const lessons = useSafetyTrainingSchedule(companyId);
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
                    {dayLessons.slice(0, 3).map((l, idx) => (
                      <div key={idx} className="truncate rounded bg-[#5B8DEF]/15 px-1 py-0.5 text-[10px] text-[#5B8DEF]" title={`${l.moduleTitle}${l.lessonTitle ? ': ' + l.lessonTitle : ''}`}>
                        {l.moduleTitle}
                      </div>
                    ))}
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
                {upcoming.map((l, idx) => (
                  <div key={idx} className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
                    <p className="text-sm font-medium text-[#F0F4F8]">{l.moduleTitle}</p>
                    <p className="text-xs text-[#8BA3BF]">
                      {new Date(l.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {l.time ? ` · ${l.time}` : ''}
                      {l.lessonTitle ? ` · ${l.lessonTitle}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
