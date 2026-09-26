import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDepartmentScope } from '../useDepartmentScope';
import { subscribeActiveShiftSessions } from '../../services/handover.service';
import { subscribeEvaluations } from '../../modules/evaluation/services/evaluation.service';

export interface HrKpis {
  /** People clocked in right now (active shift sessions today). */
  presentToday: number;
  /** Training assignments currently in progress. */
  trainingsInProgress: number;
  /** Evaluations still being worked on (saved as drafts, not yet submitted). */
  evaluationsInProgress: number;
  /** Active company headcount. */
  activeStaff: number;
}

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
  const [sessionUserIds, setSessionUserIds] = useState<string[]>([]);
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
      (sessions) => {
        setSessionUserIds(sessions.map((s) => s.userId));
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
          snap.docs.filter((d) => d.data().status === 'in_progress').map((d) => String(d.data().traineeId ?? '')),
        );
        done();
      },
      () => done(),
    );

    const unsubUsers = onSnapshot(
      collection(db, `companies/${companyId}/users`),
      (snap) => {
        // Count everyone who isn't deactivated — legacy users have no status.
        setActiveUsers(
          snap.docs
            .filter((d) => (d.data().status ?? 'active') !== 'inactive')
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
    // Users with no plant assigned yet are kept (same as usePlantUserIds) —
    // dropping them zeroed every KPI for companies whose roster predates
    // plants. Only people registered to a *different* plant are excluded.
    const staff = plantId ? activeUsers.filter((u) => !u.plantId || u.plantId === plantId) : activeUsers;
    const staffIds = plantId ? new Set(staff.map((u) => u.id)) : null;
    const inPlant = (id: string) => !staffIds || staffIds.has(id);
    return {
      presentToday: sessionUserIds.filter(inPlant).length,
      trainingsInProgress: inProgressTraineeIds.filter(inPlant).length,
      evaluationsInProgress: draftEvaluateeIds.filter(inPlant).length,
      activeStaff: staff.length,
    };
  }, [plantId, activeUsers, sessionUserIds, inProgressTraineeIds, draftEvaluateeIds]);

  return { kpis, loading };
}
