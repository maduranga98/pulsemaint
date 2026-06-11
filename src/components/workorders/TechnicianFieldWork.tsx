import { useState, useEffect } from 'react';
import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { Camera, Send, Check, CloudUpload, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { queuePhoto, getPendingPhotosForWO, type PendingPhoto } from '../../lib/offline/photoQueue';
import { syncPendingPhotos } from '../../lib/offline/photoSync';
import { usePendingPhotoSync } from '../../hooks/usePendingPhotoSync';
import { PendingSyncBadge } from '../offline/PendingSyncBadge';
import type { WorkOrder, ChecklistItem } from '../../types/workOrder';

interface TechnicianFieldWorkProps {
  workOrder: WorkOrder;
}

/**
 * Technician field-work surface — works fully offline. Checklist ticks and
 * repair-step notes are written through Firestore (offline writes are queued by
 * the persistent local cache and flushed on reconnect). Photos are queued in
 * IndexedDB and uploaded to Storage when the network returns.
 */
export function TechnicianFieldWork({ workOrder }: TechnicianFieldWorkProps) {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const online = useOnlineStatus();
  const { count: pendingCount } = usePendingPhotoSync(workOrder.id);

  const uid = user?.uid ?? userProfile?.id ?? '';
  const userName = userProfile?.fullName ?? user?.displayName ?? 'Technician';

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  async function refreshPending() {
    setPendingPhotos(await getPendingPhotosForWO(workOrder.id));
  }
  useEffect(() => {
    void refreshPending();
  }, [workOrder.id, pendingCount]);

  // --- Checklist ticking (offline-safe via Firestore queued writes) ---
  async function toggleStep(index: number) {
    const updated: ChecklistItem[] = workOrder.checklist.map((c, i) => {
      if (i !== index) return c;
      if (c.isCompleted) {
        return { ...c, isCompleted: false, completedBy: null, completedByName: null, completedAt: null };
      }
      return {
        ...c,
        isCompleted: true,
        completedBy: uid,
        completedByName: userName,
        completedAt: Timestamp.now(),
      };
    });
    // Do not await: offline writes resolve only on reconnect; the local cache
    // applies them immediately so the UI updates without blocking.
    void updateDoc(doc(db, 'workOrders', workOrder.id), {
      checklist: updated,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }

  // --- Repair-step log (offline-safe) ---
  async function addNote() {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSavingNote(true);
    setNote('');
    try {
      void updateDoc(doc(db, 'workOrders', workOrder.id), {
        repairLog: arrayUnion({
          note: trimmed,
          by: uid,
          byName: userName,
          at: Timestamp.now(),
        }),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      if (!online) toast.success('Saved offline — will sync when reconnected');
    } finally {
      setSavingNote(false);
    }
  }

  // --- Photo capture (queue in IndexedDB, upload on reconnect) ---
  async function handlePhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const siteId = workOrder.siteId;
    for (const file of Array.from(files)) {
      await queuePhoto({
        woId: workOrder.id,
        siteId,
        file,
        fileName: file.name || `photo_${Date.now()}.jpg`,
        contentType: file.type || 'image/jpeg',
      });
    }
    await refreshPending();
    if (online) {
      void syncPendingPhotos();
      toast.success('Photo uploading…');
    } else {
      toast.success('Photo saved offline — will upload when reconnected');
    }
  }

  const completedCount = workOrder.checklist.filter((c) => c.isCompleted).length;
  const repairLog = (workOrder.repairLog ?? []).slice().sort((a, b) => {
    const ta = (a.at as any)?.toMillis?.() ?? 0;
    const tb = (b.at as any)?.toMillis?.() ?? 0;
    return tb - ta;
  });

  return (
    <div className="space-y-6">
      {!online && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <WifiOff className="w-4 h-4" />
          You're offline. Tick steps, log notes and capture photos — everything syncs automatically when you reconnect.
        </div>
      )}

      {/* Checklist ticking */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Checklist</h3>
          <span className="text-xs text-gray-500">
            {completedCount} / {workOrder.checklist.length} done
          </span>
        </div>
        {workOrder.checklist.length === 0 ? (
          <p className="text-sm text-gray-400">No checklist steps.</p>
        ) : (
          <ul className="space-y-2">
            {workOrder.checklist.map((item, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => void toggleStep(i)}
                  className="w-full flex items-start gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2.5 text-left"
                >
                  <span
                    className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded border flex items-center justify-center ${
                      item.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {item.isCompleted && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className={`text-sm ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {item.stepDescription}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Repair-step log */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Repair Log</h3>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNote())}
            placeholder="Log a repair step…"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={savingNote || !note.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> Log
          </button>
        </div>
        {repairLog.length > 0 && (
          <ul className="mt-3 space-y-2">
            {repairLog.map((entry, i) => (
              <li key={i} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-800">{entry.note}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {entry.byName}
                  {(entry.at as any)?.toDate ? ` · ${(entry.at as any).toDate().toLocaleString()}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Photo capture */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Repair Photos</h3>
          <PendingSyncBadge woId={workOrder.id} />
        </div>

        <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
          <Camera className="w-4 h-4" />
          Capture / add photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => void handlePhotos(e.target.files)}
          />
        </label>

        {/* Already-synced repair photos */}
        {(workOrder.repairPhotos ?? []).length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {(workOrder.repairPhotos ?? []).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Repair ${i + 1}`} className="aspect-square rounded-lg object-cover w-full" />
              </a>
            ))}
          </div>
        )}

        {/* Queued (not yet uploaded) photos */}
        {pendingPhotos.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] text-amber-600 mb-1 flex items-center gap-1">
              <CloudUpload className="w-3.5 h-3.5" /> {pendingPhotos.length} waiting to upload
            </p>
            <div className="grid grid-cols-3 gap-2">
              {pendingPhotos.map((p) => (
                <div key={p.id} className="relative">
                  <img
                    src={URL.createObjectURL(p.blob)}
                    alt={p.fileName}
                    className="aspect-square rounded-lg object-cover w-full opacity-70"
                  />
                  <span className="absolute top-1 right-1 bg-amber-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                    PENDING
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
