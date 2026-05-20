const DB_NAME = 'triage_offline_queue';
const STORE_NAME = 'photo_uploads';
const DB_VERSION = 1;

export interface OfflinePhotoUpload {
  id: string;
  sessionId: string;
  stepId: string;
  blob: Blob;
  fileName: string;
  createdAt: number;
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function enqueuePhotoUpload(
  item: Omit<OfflinePhotoUpload, 'retryCount'>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ ...item, retryCount: 0 });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function getPendingUploads(): Promise<OfflinePhotoUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = (e) => resolve((e.target as IDBRequest<OfflinePhotoUpload[]>).result);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function removeUploadFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function incrementRetryCount(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = (e) => {
      const item = (e.target as IDBRequest<OfflinePhotoUpload>).result;
      if (item) {
        item.retryCount += 1;
        store.put(item).onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getReq.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}
