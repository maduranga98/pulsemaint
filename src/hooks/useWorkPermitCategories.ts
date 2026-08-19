import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WORK_PERMIT_CATEGORIES } from '../types/safety';
import type { WorkPermitCategory } from '../types/safety';

export interface WorkPermitCategoryOption {
  value: WorkPermitCategory;
  label: string;
  precautions: string[];
  /** Company-added categories have no seeded precaution prompts. */
  custom?: boolean;
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * The 7 seeded work permit categories, plus whatever custom ones this
 * company has added — mirrors useDepartments' "predefined + company-added"
 * pattern, but categories also carry a label and precaution prompts, not
 * just a name, so they're kept as a Firestore collection of full option
 * objects instead of bare strings.
 */
export function useWorkPermitCategories(companyId: string) {
  const [customCategories, setCustomCategories] = useState<WorkPermitCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const existingRef = useRef<Set<string>>(new Set(WORK_PERMIT_CATEGORIES.map((c) => c.value)));

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'work_permit_categories'), where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const custom = snap.docs.map((d) => ({
          value: d.data().value as WorkPermitCategory,
          label: d.data().label as string,
          precautions: [] as string[],
          custom: true as const,
        }));
        existingRef.current = new Set([...WORK_PERMIT_CATEGORIES.map((c) => c.value), ...custom.map((c) => c.value)]);
        setCustomCategories(custom);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [companyId]);

  const categories: WorkPermitCategoryOption[] = [...WORK_PERMIT_CATEGORIES, ...customCategories];

  /** Adds a new category (dedupes by slugified value) and returns its value. */
  const addCategory = async (label: string): Promise<WorkPermitCategory | null> => {
    const trimmed = label.trim();
    if (!trimmed || !companyId) return null;
    const value = slugify(trimmed) as WorkPermitCategory;
    if (!value) return null;
    if (existingRef.current.has(value)) return value;
    await addDoc(collection(db, 'work_permit_categories'), {
      companyId,
      value,
      label: trimmed,
      createdAt: serverTimestamp(),
    });
    return value;
  };

  return { categories, loading, addCategory };
}
