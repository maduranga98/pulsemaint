import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
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
  const [kpis, setKpis] = useState<HrKpis>({
    presentToday: 0,
    trainingsInProgress: 0,
    evaluationsInProgress: 0,
    activeStaff: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const patch = (p: Partial<HrKpis>) => setKpis((prev) => ({ ...prev, ...p }));
    // First payload from any stream is enough to drop the skeleton.
    const done = () => setLoading(false);

    const unsubShifts = subscribeActiveShiftSessions(
      companyId,
      (sessions) => {
        patch({ presentToday: sessions.length });
        done();
      },
      () => done(),
    );

    const unsubEvals = subscribeEvaluations(
      companyId,
      (sessions) => {
        patch({ evaluationsInProgress: sessions.filter((s) => s.status === 'draft').length });
        done();
      },
      () => done(),
    );

    const unsubTraining = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        patch({ trainingsInProgress: snap.docs.filter((d) => d.data().status === 'in_progress').length });
        done();
      },
      () => done(),
    );

    const unsubUsers = onSnapshot(
      collection(db, `companies/${companyId}/users`),
      (snap) => {
        // Count everyone who isn't deactivated — legacy users have no status.
        patch({ activeStaff: snap.docs.filter((d) => (d.data().status ?? 'active') !== 'inactive').length });
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

  return { kpis, loading };
}
