import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useDepartments(companyId: string) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'departments'), where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDepartments(snap.docs.map((d) => d.data().name as string).sort());
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [companyId]);

  const addDepartment = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !companyId) return;
    await addDoc(collection(db, 'departments'), {
      companyId,
      name: trimmed,
      createdAt: serverTimestamp(),
    });
  };

  return { departments, loading, addDepartment };
}
