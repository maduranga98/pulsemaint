import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type {
  InventoryPart,
  PartCategory,
  PartStatus,
  PartCriticality,
} from '@/types/inventory';
import { getStockStatus } from '@/lib/inventory/stockCalculator';

export interface UseInventoryPartsOptions {
  category?: PartCategory;
  status?: PartStatus;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  criticality?: PartCriticality;
  searchQuery?: string;
  pageSize?: number;
}

interface UseInventoryPartsResult {
  parts: InventoryPart[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
}

export function useInventoryParts(options: UseInventoryPartsOptions = {}): UseInventoryPartsResult {
  const { category, status, stockStatus, criticality, searchQuery, pageSize = 50 } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [allParts, setAllParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(pageSize);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build base query - companyId always filtered
    // We fetch all matching docs for client-side search/stock filtering
    const constraints: Parameters<typeof query>[1][] = [
      where('companyId', '==', companyId),
    ];

    if (category) {
      constraints.push(where('category', '==', category));
    }
    if (status) {
      constraints.push(where('status', '==', status));
    }
    if (criticality) {
      constraints.push(where('criticality', '==', criticality));
    }

    constraints.push(orderBy('name', 'asc'));

    const q = query(collection(db, 'inventoryParts'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let parts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as InventoryPart[];

        // Client-side stock status filter (computed field)
        if (stockStatus) {
          parts = parts.filter((p) => getStockStatus(p) === stockStatus);
        }

        // Client-side search
        if (searchQuery && searchQuery.trim() !== '') {
          const q = searchQuery.trim().toLowerCase();
          parts = parts.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.partNumber.toLowerCase().includes(q) ||
              p.brand.toLowerCase().includes(q) ||
              p.supplierName.toLowerCase().includes(q)
          );
        }

        setAllParts(parts);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, category, status, criticality, stockStatus, searchQuery]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(pageSize);
  }, [category, status, criticality, stockStatus, searchQuery, pageSize]);

  const parts = allParts.slice(0, displayCount);
  const hasMore = displayCount < allParts.length;

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + pageSize);
  }, [pageSize]);

  return {
    parts,
    loading,
    error,
    totalCount: allParts.length,
    hasMore,
    loadMore,
  };
}
