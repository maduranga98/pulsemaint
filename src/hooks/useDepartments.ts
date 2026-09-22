import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Departments are a sub-category of a plant (main category) — the same
// department name in two different plants must be treated as two distinct
// departments, so every query/write here is scoped by BOTH companyId and
// plantId. Pass `null`/`undefined` plantId only for an admin context that
// has not yet selected a plant; that returns an empty list rather than a
// cross-plant merge, since there is no "all plants" department scope.
export function useDepartments(companyId: string, plantId: string | null | undefined) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Mirrors `departments` for addDepartment's duplicate check without
  // depending on it (avoiding an extra effect re-subscribe on every change).
  const departmentsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!companyId || !plantId) {
      setDepartments([]);
      departmentsRef.current = [];
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'departments'),
      where('companyId', '==', companyId),
      where('plantId', '==', plantId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Multiple docs can carry the same name (e.g. a duplicate created
        // before this guard existed) — collapse them so the UI never shows
        // the same department as two separate category cards.
        const names = snap.docs.map((d) => d.data().name as string);
        const deduped = Array.from(new Set(names)).sort();
        departmentsRef.current = deduped;
        setDepartments(deduped);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [companyId, plantId]);

  const addDepartment = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !companyId || !plantId) return;
    if (departmentsRef.current.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return;
    await addDoc(collection(db, 'departments'), {
      companyId,
      plantId,
      name: trimmed,
      createdAt: serverTimestamp(),
    });
  };

  return { departments, loading, addDepartment };
}
