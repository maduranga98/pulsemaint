import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { usePlantMachineIds } from '../../../hooks/usePlantMachineIds';
import { usePlantFilter } from '../../../hooks/usePlantFilter';
import type { KaizenCard, KaizenStats, KaizenTrendMonth } from '../types/kaizen.types';
import type { KaizenFilters } from '../services/kaizen.service';
import {
  subscribeKaizenList,
  subscribeKaizenCard,
  fetchKaizenStats,
  fetchKaizenTrend,
} from '../services/kaizen.service';

// ─── plant scoping ────────────────────────────────────────────────────────────

/** A card belongs to the caller's plant via its machine's plant, falling back
 * to the raiser's plant. Always true when not plant-scoped. */
function useKaizenPlantFilter(companyId: string | undefined) {
  const plantMachineIds = usePlantMachineIds(companyId);
  const { inPlant, isPlantScoped } = usePlantFilter(companyId);
  return useCallback(
    (c: KaizenCard) =>
      !isPlantScoped ||
      (c.machineId && plantMachineIds ? plantMachineIds.has(c.machineId) : inPlant(null, c.raisedBy)),
    [isPlantScoped, plantMachineIds, inPlant],
  );
}

// ─── useKaizenList ────────────────────────────────────────────────────────────

interface UseKaizenListResult {
  cards: KaizenCard[];
  loading: boolean;
  error: string | null;
}

export function useKaizenList(filters: KaizenFilters = {}): UseKaizenListResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [allCards, setCards] = useState<KaizenCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // (Kaizen's `plantId` above is legacy naming for the company id.) Only the
  // caller's real plant: the card's machine's plant, falling back to the
  // raiser's plant (admin: selected plant tab).
  const cardInPlant = useKaizenPlantFilter(plantId);
  const cards = useMemo(() => allCards.filter(cardInPlant), [allCards, cardInPlant]);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    setError(null);
    const unsub = subscribeKaizenList(
      plantId,
      filters,
      200,
      (data) => {
        setCards(data);
        setLoading(false);
      },
      (e) => setError(e.message)
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId, filterKey]);

  return { cards, loading, error };
}

// ─── useKaizenCard ────────────────────────────────────────────────────────────

interface UseKaizenCardResult {
  card: KaizenCard | null;
  loading: boolean;
  error: string | null;
}

export function useKaizenCard(cardId: string): UseKaizenCardResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [card, setCard] = useState<KaizenCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId || !cardId) return;
    setLoading(true);
    const unsub = subscribeKaizenCard(
      plantId,
      cardId,
      (data) => {
        setCard(data);
        setLoading(false);
      },
      (e) => setError(e.message)
    );
    return unsub;
  }, [plantId, cardId]);

  return { card, loading, error };
}

// ─── useKaizenStats ───────────────────────────────────────────────────────────

interface DateRange {
  startDate?: string;
  endDate?: string;
}

interface UseKaizenStatsResult {
  stats: KaizenStats | null;
  loading: boolean;
  error: string | null;
}

export function useKaizenStats(dateRange?: DateRange): UseKaizenStatsResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [stats, setStats] = useState<KaizenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardInPlant = useKaizenPlantFilter(plantId);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    fetchKaizenStats(plantId, dateRange?.startDate, dateRange?.endDate, cardInPlant)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [plantId, dateRange?.startDate, dateRange?.endDate, cardInPlant]);

  return { stats, loading, error };
}

// ─── useMyKaizens ─────────────────────────────────────────────────────────────

export function useMyKaizens(): UseKaizenListResult {
  const userId = useAuthStore((s) => s.userProfile?.id);
  const filters = useMemo(() => ({ raisedBy: userId ?? '' }), [userId]);
  return useKaizenList(filters);
}

// ─── useKaizenTrend ───────────────────────────────────────────────────────────

interface UseKaizenTrendResult {
  trend: KaizenTrendMonth[];
  loading: boolean;
  error: string | null;
}

export function useKaizenTrend(months = 12): UseKaizenTrendResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [trend, setTrend] = useState<KaizenTrendMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardInPlant = useKaizenPlantFilter(plantId);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    fetchKaizenTrend(plantId, months, cardInPlant)
      .then((data) => {
        setTrend(data as KaizenTrendMonth[]);
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [plantId, months, cardInPlant]);

  return { trend, loading, error };
}
