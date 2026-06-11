import { useEffect } from 'react';
import { WifiOff, RefreshCw, CloudUpload } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePendingPhotoSync } from '../../hooks/usePendingPhotoSync';
import { syncPendingPhotos, initPhotoSync } from '../../lib/offline/photoSync';

/**
 * Global banner: shows an offline indicator when the network is down, and a
 * "syncing pending changes" indicator while queued photos upload on reconnect.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { count } = usePendingPhotoSync();

  useEffect(() => {
    initPhotoSync();
  }, []);

  // Kick a sync whenever we come back online with a pending queue.
  useEffect(() => {
    if (online && count > 0) {
      void syncPendingPhotos();
    }
  }, [online, count]);

  if (online && count === 0) return null;

  if (!online) {
    return (
      <div className="bg-amber-500 text-white text-[13px] font-medium px-4 py-1.5 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        Offline — changes are saved on this device and will sync when you reconnect.
        {count > 0 && <span className="opacity-90">({count} photo{count === 1 ? '' : 's'} queued)</span>}
      </div>
    );
  }

  // Online with a pending queue → syncing.
  return (
    <div className="bg-blue-600 text-white text-[13px] font-medium px-4 py-1.5 flex items-center justify-center gap-2">
      <CloudUpload className="w-4 h-4" />
      Syncing {count} pending photo{count === 1 ? '' : 's'}…
      <button
        type="button"
        onClick={() => void syncPendingPhotos()}
        className="inline-flex items-center gap-1 underline opacity-90 hover:opacity-100"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Retry now
      </button>
    </div>
  );
}
