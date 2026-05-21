import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContentLibraryItem, ContentLibraryItemType } from '@/lib/training/trainingTypes';

export interface UseContentLibraryOptions {
  type?: ContentLibraryItemType;
  searchQuery?: string;
}

interface UseContentLibraryResult {
  items: ContentLibraryItem[];
  loading: boolean;
  error: string | null;
  deleteItem: (id: string, storageUrl?: string) => Promise<void>;
}

export function useContentLibrary(
  options: UseContentLibraryOptions = {}
): UseContentLibraryResult {
  const { type, searchQuery } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [items, setItems] = useState<ContentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const baseConstraints = [where('companyId', '==', companyId), orderBy('uploadedAt', 'desc')];
    const typeConstraint = type ? [where('type', '==', type)] : [];
    const q = query(collection(db, 'trainingContentLibrary'), ...typeConstraint, ...baseConstraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentLibraryItem));

        if (searchQuery) {
          const lower = searchQuery.toLowerCase();
          result = result.filter(
            (item) =>
              item.name.toLowerCase().includes(lower) ||
              item.tags.some((t) => t.toLowerCase().includes(lower))
          );
        }

        setItems(result);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, type, searchQuery]);

  const deleteItem = async (id: string, storageUrl?: string) => {
    if (storageUrl) {
      try {
        const storageRef = ref(storage, storageUrl);
        await deleteObject(storageRef);
      } catch {
        // Storage object may already be gone — proceed
      }
    }
    await deleteDoc(doc(db, 'trainingContentLibrary', id));
  };

  return { items, loading, error, deleteItem };
}
