import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { plantConstraints } from '../../lib/plantQuery';
import {
  buildPeopleActivity,
  type ActivityTicket,
  type ActivityTraining,
  type ActivityWorkOrder,
  type PersonActivity,
} from '../../lib/dashboard/peopleActivity';

/**
 * Live "what is each person doing right now" for the Shift / Team Status
 * widgets: in-progress work orders, breakdowns being attended and trainings
 * in progress. A failed read (e.g. a role without access) just leaves that
 * kind of activity out.
 */
export function usePeopleActivity(companyId: string | undefined): Map<string, PersonActivity[]> {
  const [workOrders, setWorkOrders] = useState<ActivityWorkOrder[]>([]);
  const [tickets, setTickets] = useState<ActivityTicket[]>([]);
  const [trainings, setTrainings] = useState<ActivityTraining[]>([]);
  // Training "recently active" ages out with time, not data changes.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    const unsubs = [
      onSnapshot(
        query(
          collection(db, 'workOrders'),
          where('companyId', '==', companyId),
          ...plantConstraints('workOrders'),
          where('status', 'in', ['IN_PROGRESS']),
        ),
        (snap) => setWorkOrders(snap.docs.map((d) => d.data() as ActivityWorkOrder)),
        () => setWorkOrders([]),
      ),
      onSnapshot(
        query(
          collection(db, 'breakdown_tickets'),
          where('siteId', '==', companyId),
          ...plantConstraints('breakdown_tickets'),
          where('status', 'in', ['en_route', 'repair_in_progress']),
        ),
        (snap) => setTickets(snap.docs.map((d) => d.data() as ActivityTicket)),
        () => setTickets([]),
      ),
      onSnapshot(
        query(
          collection(db, 'trainingAssignments'),
          where('companyId', '==', companyId),
          where('status', '==', 'in_progress'),
        ),
        (snap) => setTrainings(snap.docs.map((d) => d.data() as ActivityTraining)),
        () => setTrainings([]),
      ),
    ];
    const timer = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => {
      unsubs.forEach((u) => u());
      clearInterval(timer);
    };
  }, [companyId]);

  return useMemo(
    () => buildPeopleActivity({ workOrders, tickets, trainings }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workOrders, tickets, trainings, tick],
  );
}
