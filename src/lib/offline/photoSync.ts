import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase';
import {
  getAllPendingPhotos,
  removePendingPhoto,
  notifyChange,
  type PendingPhoto,
} from './photoQueue';

// ---------------------------------------------------------------------------
// Uploads queued repair photos to Storage and links them onto the WO doc.
// Safe to call repeatedly; runs at most once at a time.
// ---------------------------------------------------------------------------

let syncing = false;

async function uploadOne(photo: PendingPhoto): Promise<void> {
  const path = `workorders/${photo.siteId}/${photo.woId}/repair-photos/${photo.id}_${photo.fileName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, photo.blob, { contentType: photo.contentType });
  const url = await getDownloadURL(storageRef);

  // Append the URL onto the WO. arrayUnion is itself offline-safe, but by the
  // time we reach here we are online (upload succeeded).
  await updateDoc(doc(db, 'workOrders', photo.woId), {
    repairPhotos: arrayUnion(url),
    updatedAt: serverTimestamp(),
  });

  await removePendingPhoto(photo.id);
}

export interface SyncResult {
  uploaded: number;
  failed: number;
}

/** Attempt to upload all pending photos. No-op when offline. */
export async function syncPendingPhotos(): Promise<SyncResult> {
  if (syncing) return { uploaded: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { uploaded: 0, failed: 0 };
  }

  syncing = true;
  let uploaded = 0;
  let failed = 0;
  try {
    const pending = await getAllPendingPhotos();
    for (const photo of pending) {
      try {
        await uploadOne(photo);
        uploaded += 1;
      } catch {
        failed += 1;
      }
    }
  } finally {
    syncing = false;
    if (uploaded > 0) notifyChange();
  }
  return { uploaded, failed };
}

let initialized = false;

/** Wire up automatic sync on reconnect + an initial attempt. Call once. */
export function initPhotoSync() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const trigger = () => {
    void syncPendingPhotos();
  };

  window.addEventListener('online', trigger);
  // Attempt an initial sync shortly after load (covers photos queued in a
  // previous session that closed before reconnecting).
  if (navigator.onLine) {
    setTimeout(trigger, 2000);
  }
}
