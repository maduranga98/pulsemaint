import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useWorkPermits } from '@/hooks/safety/useSafety';

interface ScheduledLesson {
  date: string;
  moduleTitle: string;
  lessonTitle: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Training lessons that carry a scheduledDate, from all training modules. */
function useScheduledLessons(companyId: string): ScheduledLesson[] {
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
      (snap) => {
        const out: ScheduledLesson[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const moduleTitle = String(data.title ?? 'Training');
          const ls = (data.lessons ?? []) as Array<{ title?: string; scheduledDate?: string }>;
          ls.forEach((l) => {
            if (l.scheduledDate) out.push({ date: l.scheduledDate, moduleTitle, lessonTitle: String(l.title ?? '') });
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
  const lessons = useScheduledLessons(companyId);
  const { permits } = useWorkPermits(companyId);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const monthLabel = cursor.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const today = ymd(new Date());

  const lessonsByDay = useMemo(() => {
    const m = new Map<string, ScheduledLesson[]>();
    lessons.forEach((l) => { m.set(l.date, [...(m.get(l.date) ?? []), l]); });
    return m;
  }, [lessons]);

  // A permit "covers" a day if the day is within [validFrom, validTo].
  function permitsOnDay(date: string): number {
    return permits.filter((p) => (p.status === 'active' || p.status === 'closed') && p.validFrom <= date && p.validTo >= date).length;
  }

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay(); // 0=Sun
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
          <CalendarDays className="h-5 w-5 text-[#5B8DEF]" /> Safety Schedule Calendar
        </h1>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="rounded-lg border border-[#1E3A5F] p-1.5 text-[#8BA3BF] hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[160px] text-center text-sm font-semibold">{monthLabel}</span>
          <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="rounded-lg border border-[#1E3A5F] p-1.5 text-[#8BA3BF] hover:text-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-4 text-xs text-[#8BA3BF]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#5B8DEF]" /> Safety training scheduled</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Work permit active</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-semibold text-[#8BA3BF]">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const dayLessons = lessonsByDay.get(date) ?? [];
          const permitCount = permitsOnDay(date);
          const isToday = date === today;
          return (
            <div
              key={i}
              className={`min-h-[84px] rounded-lg border p-1.5 ${isToday ? 'border-[#1A56DB] bg-[#1A56DB]/10' : 'border-[#1E3A5F] bg-[#0F1E35]'}`}
            >
              <div className="text-xs font-semibold text-[#8BA3BF]">{Number(date.slice(8, 10))}</div>
              <div className="mt-1 space-y-1">
                {dayLessons.slice(0, 2).map((l, idx) => (
                  <div key={idx} className="truncate rounded bg-[#5B8DEF]/15 px-1 py-0.5 text-[10px] text-[#5B8DEF]" title={`${l.moduleTitle}: ${l.lessonTitle}`}>
                    {l.moduleTitle}
                  </div>
                ))}
                {dayLessons.length > 2 && <div className="text-[10px] text-[#8BA3BF]">+{dayLessons.length - 2} more</div>}
                {permitCount > 0 && (
                  <div className="truncate rounded bg-[#F59E0B]/15 px-1 py-0.5 text-[10px] text-[#F59E0B]">{permitCount} permit{permitCount > 1 ? 's' : ''}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
