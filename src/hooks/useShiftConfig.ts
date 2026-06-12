import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { ShiftConfig } from '@/types/handover.types';
import { deleteShiftConfig, fetchShiftConfigs, saveShiftConfig } from '@/services/handover.service';

export function useShiftConfig() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    try {
      setShifts(await fetchShiftConfigs(companyId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }

  async function save(payload: Omit<ShiftConfig, 'id' | 'companyId'> & { id?: string }) {
    if (!companyId) return '';
    const id = await saveShiftConfig(companyId, payload);
    await load();
    return id;
  }

  async function remove(id: string) {
    await deleteShiftConfig(id);
    await load();
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  return { shifts, loading, error, reload: load, save, remove };
}
