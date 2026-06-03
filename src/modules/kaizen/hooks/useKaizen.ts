import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../../store/authStore';
import type { KaizenCard, KaizenStats, KaizenTrendMonth } from '../types/kaizen.types';
import type { KaizenFilters } from '../services/kaizen.service';
import {
  subscribeKaizenList,
  subscribeKaizenCard,
  fetchKaizenStats,
  fetchKaizenTrend,
} from '../services/kaizen.service';

// ─── useKaizenList ────────────────────────────────────────────────────────────

interface UseKaizenListResult {
  cards: KaizenCard[];
  loading: boolean;
  error: string | null;
}

export function useKaizenList(filters: KaizenFilters = {}): UseKaizenListResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [cards, setCards] = useState<KaizenCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    fetchKaizenStats(plantId, dateRange?.startDate, dateRange?.endDate)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [plantId, dateRange?.startDate, dateRange?.endDate]);

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

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    fetchKaizenTrend(plantId, months)
      .then((data) => {
        setTrend(data as KaizenTrendMonth[]);
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [plantId, months]);

  return { trend, loading, error };
}
