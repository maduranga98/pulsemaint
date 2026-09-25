import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDepartmentScope } from '../useDepartmentScope';
import { subscribeActiveShiftSessions } from '../../services/handover.service';
import { subscribeEvaluations } from '../../modules/evaluation/services/evaluation.service';
import { presentUserIds } from '../../lib/shiftPresence';
import type { ShiftSession } from '../../types/handover.types';

export interface HrKpis {
  /** Distinct people clocked in right now (stale, never-ended sessions excluded). */
  presentToday: number;
  /** Training assignments started but not yet passed (in progress or retaking a failed quiz). */
  trainingsInProgress: number;
  /** Evaluations still being worked on (saved as drafts, not yet submitted). */
  evaluationsInProgress: number;
  /** Active company headcount — same rule as HR Analytics' Staff Headcount. */
  activeStaff: number;
}

// Started but not yet passed. not_started is only assigned; quiz_passed,
// awaiting_practical and certified are counted as completed elsewhere.
const IN_PROGRESS_TRAINING = new Set(['in_progress', 'quiz_failed']);

/**
 * The HR Officer dashboard's headline numbers, all live.
 *
 * Every source is scoped by companyId and streamed via onSnapshot so the
 * strip updates the instant someone clocks in/out, a training moves forward,
 * an evaluation is drafted/submitted, or the roster changes — no reload.
 */
export function useHrKpis(companyId: string) {
  // Raw live rows; the KPIs are derived below so they can be narrowed to the
  // caller's plant (plant-scoped roles, or admin with a plant tab selected).
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [draftEvaluateeIds, setDraftEvaluateeIds] = useState<string[]>([]);
  const [inProgressTraineeIds, setInProgressTraineeIds] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<{ id: string; plantId: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const { plantId } = useDepartmentScope();

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // First payload from any stream is enough to drop the skeleton.
    const done = () => setLoading(false);

    const unsubShifts = subscribeActiveShiftSessions(
      companyId,
      (next) => {
        setSessions(next);
        done();
      },
      () => done(),
    );

    const unsubEvals = subscribeEvaluations(
      companyId,
      (sessions) => {
        setDraftEvaluateeIds(sessions.filter((s) => s.status === 'draft').map((s) => s.evaluateeId));
        done();
      },
      () => done(),
    );

    const unsubTraining = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setInProgressTraineeIds(
          snap.docs
            .filter((d) => IN_PROGRESS_TRAINING.has(String(d.data().status)))
            .map((d) => String(d.data().traineeId ?? '')),
        );
        done();
      },
      () => done(),
    );

    const unsubUsers = onSnapshot(
      collection(db, `companies/${companyId}/users`),
      (snap) => {
        // Active profiles only (legacy users have no status) — pending
        // invites and deactivated users aren't staff yet / any more. Matches
        // fetchTeamPerformanceByRole so this card and the Analytics Staff
        // Headcount chart show the same number.
        setActiveUsers(
          snap.docs
            .filter((d) => (d.data().status ?? 'active') === 'active')
            .map((d) => ({ id: d.id, plantId: d.data().plantId ?? null })),
        );
        done();
      },
      () => done(),
    );

    return () => {
      unsubShifts();
      unsubEvals();
      unsubTraining();
      unsubUsers();
    };
  }, [companyId]);

  const kpis = useMemo<HrKpis>(() => {
    // Users with no plant assigned yet stay in every plant's count, the same
    // rule usePlantUserIds applies to the rest of the dashboard.
    const staff = plantId ? activeUsers.filter((u) => !u.plantId || u.plantId === plantId) : activeUsers;
    const staffIds = plantId ? new Set(staff.map((u) => u.id)) : null;
    const inPlant = (id: string) => !staffIds || staffIds.has(id);
    return {
      presentToday: presentUserIds(sessions).filter(inPlant).length,
      trainingsInProgress: inProgressTraineeIds.filter(inPlant).length,
      evaluationsInProgress: draftEvaluateeIds.filter(inPlant).length,
      activeStaff: staff.length,
    };
  }, [plantId, activeUsers, sessions, inProgressTraineeIds, draftEvaluateeIds]);

  return { kpis, loading };
}
