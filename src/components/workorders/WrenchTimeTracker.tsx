import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { Clock, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import type { WorkOrder, TimeSegment, TimeSegmentState } from '../../types/workOrder';
import { computeWrenchTimePercent } from '../../lib/reliabilityUtils';

interface WrenchTimeTrackerProps {
  workOrder: WorkOrder;
  readOnly?: boolean;
}

const STATE_CONFIG: Record<
  TimeSegmentState,
  { label: string; color: string; activeColor: string; bgColor: string }
> = {
  travel: {
    label: 'Travel',
    color: 'border-blue-300 text-blue-700',
    activeColor: 'bg-blue-600 text-white',
    bgColor: 'bg-blue-50',
  },
  'waiting-parts': {
    label: 'Waiting – Parts',
    color: 'border-amber-300 text-amber-700',
    activeColor: 'bg-amber-500 text-white',
    bgColor: 'bg-amber-50',
  },
  'waiting-permit': {
    label: 'Waiting – Permit',
    color: 'border-orange-300 text-orange-700',
    activeColor: 'bg-orange-500 text-white',
    bgColor: 'bg-orange-50',
  },
  working: {
    label: 'Working',
    color: 'border-emerald-300 text-emerald-700',
    activeColor: 'bg-emerald-600 text-white',
    bgColor: 'bg-emerald-50',
  },
};

const STATES: TimeSegmentState[] = ['travel', 'waiting-parts', 'waiting-permit', 'working'];

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function WrenchTimeTracker({ workOrder, readOnly = false }: WrenchTimeTrackerProps) {
  const segments: TimeSegment[] = workOrder.timeSegments ?? [];

  const activeSegment = segments.find((s) => s.endAt === null) ?? null;
  const activeState = activeSegment?.state ?? null;

  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeSegment) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
      return;
    }
    const startMs =
      (activeSegment.startAt as any)?.toMillis?.() ??
      Number(activeSegment.startAt);

    function tick() {
      setElapsed(Date.now() - startMs);
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeSegment]);

  async function handleStateClick(state: TimeSegmentState) {
    if (readOnly) return;

    const now = Timestamp.now();
    let newSegments = [...segments];

    if (activeState === state) {
      // Stop current segment
      newSegments = newSegments.map((s) =>
        s.endAt === null ? { ...s, endAt: now } : s,
      );
    } else {
      // End current segment (if any) and start new one
      newSegments = newSegments.map((s) =>
        s.endAt === null ? { ...s, endAt: now } : s,
      );
      newSegments.push({
        state,
        startAt: now,
        endAt: null,
        note: null,
      });
    }

    try {
      await updateDoc(doc(db, 'workOrders', workOrder.id), {
        timeSegments: newSegments,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      toast.error('Failed to update time segment.');
    }
  }

  const wrenchPct = computeWrenchTimePercent(segments);
  const completedSegments = segments.filter((s) => s.endAt !== null);

  function segmentDurationMs(seg: TimeSegment): number {
    const startMs = (seg.startAt as any)?.toMillis?.() ?? Number(seg.startAt);
    const endMs = (seg.endAt as any)?.toMillis?.() ?? Number(seg.endAt);
    return Math.max(0, endMs - startMs);
  }

  return (
    <div className="space-y-5">
      {/* Active segment display */}
      {activeState ? (
        <div
          className={`rounded-xl p-4 flex items-center gap-3 ${
            STATE_CONFIG[activeState].bgColor
          }`}
        >
          <Clock className="w-5 h-5 text-gray-600 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">
              {STATE_CONFIG[activeState].label}
            </p>
            <p className="text-2xl font-mono font-bold text-gray-900">
              {formatMs(elapsed)}
            </p>
          </div>
          <span className="text-xs text-gray-500">Live</span>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-gray-400" />
          <p className="text-sm text-gray-500">No active time segment.</p>
        </div>
      )}

      {/* State buttons */}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-2">
          {STATES.map((state) => {
            const cfg = STATE_CONFIG[state];
            const isActive = activeState === state;
            return (
              <button
                key={state}
                type="button"
                onClick={() => handleStateClick(state)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  isActive ? cfg.activeColor + ' border-transparent' : cfg.color + ' bg-white hover:opacity-80'
                }`}
              >
                {isActive ? `■ Stop (${cfg.label})` : `▶ ${cfg.label}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Wrench time % */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-gray-700">Wrench Time</span>
          <span className="ml-auto text-2xl font-bold text-gray-900">{wrenchPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${wrenchPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          % of logged time spent actively working (vs. travel / waiting)
        </p>
      </div>

      {/* Segments summary */}
      {completedSegments.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Completed Segments
          </h4>
          <div className="space-y-1">
            {completedSegments.map((seg, idx) => {
              const cfg = STATE_CONFIG[seg.state];
              const dur = segmentDurationMs(seg);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.bgColor} ${cfg.color.split(' ')[1]}`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-xs text-gray-500 font-mono ml-auto">
                    {formatMs(dur)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          No time segments logged yet.
        </p>
      )}
    </div>
  );
}
