import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/auth';

export interface UseTraineeListOptions {
  department?: string;
  searchQuery?: string;
}

interface UseTraineeListResult {
  trainees: UserProfile[];
  loading: boolean;
  error: string | null;
}

export function useTraineeList(
  options: UseTraineeListOptions = {}
): UseTraineeListResult {
  const { department, searchQuery } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [trainees, setTrainees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Profiles live in the per-company subcollection (see
    // companies/{id}/users used by UsersPage, auth.ts, etc). Querying the
    // top-level `users` collection returned nothing, which is why the
    // assign-training wizard showed no trainees.
    //
    // This hook backs the "Trainee Management" assignment flow
    // (AssignTrainingWizard / AssignTrainingPage), which is trainee-specific
    // — only accounts with role `trainee` should be assignable here. General
    // workforce training for other roles (technician, floor_operator,
    // store_keeper, supervisor, hr_officer) is not exposed through this
    // flow; if/when a separate general-workforce assignment flow exists it
    // should query independently rather than widening this list.
    const TRAINABLE_ROLES = ['trainee'];
    // No orderBy here: `role in […]` + orderBy(fullName) needs a composite
    // index that isn't deployed, which made the query fail silently and the
    // assign-training wizard show "No trainees found". Sort client-side.
    const q = query(
      collection(db, `companies/${companyId}/users`),
      where('role', 'in', TRAINABLE_ROLES),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as UserProfile)
          .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));

        if (department) {
          docs = docs.filter((u) => u.department === department);
        }

        if (searchQuery && searchQuery.trim() !== '') {
          const term = searchQuery.trim().toLowerCase();
          docs = docs.filter(
            (u) =>
              u.fullName.toLowerCase().includes(term) ||
              (u.email ?? '').toLowerCase().includes(term) ||
              (u.department ?? '').toLowerCase().includes(term) ||
              (u.employeeId ?? '').toLowerCase().includes(term)
          );
        }

        setTrainees(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, department, searchQuery]);

  return { trainees, loading, error };
}
