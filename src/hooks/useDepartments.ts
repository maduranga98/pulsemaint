import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useDepartments(companyId: string) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Mirrors `departments` for addDepartment's duplicate check without
  // depending on it (avoiding an extra effect re-subscribe on every change).
  const departmentsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'departments'), where('companyId', '==', companyId));
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
  }, [companyId]);

  const addDepartment = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !companyId) return;
    if (departmentsRef.current.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return;
    await addDoc(collection(db, 'departments'), {
      companyId,
      name: trimmed,
      createdAt: serverTimestamp(),
    });
  };

  return { departments, loading, addDepartment };
}
