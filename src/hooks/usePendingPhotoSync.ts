import { useState, useEffect, useCallback } from 'react';
import {
  countPendingPhotos,
  countPendingPhotosForWO,
  onQueueChange,
} from '../lib/offline/photoQueue';

/**
 * Tracks how many photos are still queued for upload. Pass a `woId` to scope
 * the count to a single work order, or omit it for the global total.
 */
export function usePendingPhotoSync(woId?: string) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const n = woId ? await countPendingPhotosForWO(woId) : await countPendingPhotos();
    setCount(n);
  }, [woId]);

  useEffect(() => {
    void refresh();
    const off = onQueueChange(() => void refresh());
    return off;
  }, [refresh]);

  return { count, refresh };
}
