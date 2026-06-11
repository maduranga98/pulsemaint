import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth }       from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
}                        from 'firebase/firestore';
import { getStorage }    from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

export const auth      = getAuth(app);

// Offline-first Firestore: IndexedDB-backed persistent cache shared across all
// open tabs. Falls back to the default in-memory client if initialization
// fails (e.g. a tab already initialized Firestore, or unsupported browser).
function initDb(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      'default',
    );
  } catch {
    return getFirestore(app, 'default');
  }
}

export const db        = initDb();
export const storage   = getStorage(app);
export const functions = getFunctions(app);

// FCM is only available in secure browser contexts with service workers
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export default app;
