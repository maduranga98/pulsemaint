import { openDB, type IDBPDatabase } from 'idb';

// ---------------------------------------------------------------------------
// IndexedDB-backed queue for repair photos captured while offline.
// Photos are stored as Blobs and uploaded to Firebase Storage on reconnect.
// ---------------------------------------------------------------------------

const DB_NAME = 'pulsemaint-offline';
const DB_VERSION = 1;
const STORE = 'pendingPhotos';

export interface PendingPhoto {
  id: string;
  woId: string;
  siteId: string;
  fileName: string;
  contentType: string;
  blob: Blob;
  createdAt: number;
  /** Optional caption / repair-step note attached to the photo. */
  note?: string;
}

let _dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('woId', 'woId');
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return _dbPromise;
}

function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Queue a photo for later upload. Returns the queued record. */
export async function queuePhoto(params: {
  woId: string;
  siteId: string;
  file: File | Blob;
  fileName: string;
  contentType: string;
  note?: string;
}): Promise<PendingPhoto> {
  const db = await getDb();
  const record: PendingPhoto = {
    id: newId(),
    woId: params.woId,
    siteId: params.siteId,
    fileName: params.fileName,
    contentType: params.contentType,
    blob: params.file,
    createdAt: Date.now(),
    note: params.note,
  };
  await db.put(STORE, record);
  notifyChange();
  return record;
}

export async function getAllPendingPhotos(): Promise<PendingPhoto[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as PendingPhoto[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPendingPhotosForWO(woId: string): Promise<PendingPhoto[]> {
  const db = await getDb();
  const all = (await db.getAllFromIndex(STORE, 'woId', woId)) as PendingPhoto[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countPendingPhotos(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

export async function countPendingPhotosForWO(woId: string): Promise<number> {
  const db = await getDb();
  return db.countFromIndex(STORE, 'woId', woId);
}

export async function removePendingPhoto(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
  notifyChange();
}

// ---------------------------------------------------------------------------
// Lightweight change notifier so hooks can re-read counts without polling.
// ---------------------------------------------------------------------------

const CHANGE_EVENT = 'pulsemaint:photo-queue-changed';

export function notifyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export function onQueueChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
