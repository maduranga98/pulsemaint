import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
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
export const db        = getFirestore(app, 'default');
export const storage   = getStorage(app);
export const functions = getFunctions(app);

// Local development only: wire the SDK to the Firebase emulators when
// VITE_USE_EMULATORS=1 (see firebase.json "emulators"). Production builds
// never set this flag.
if (import.meta.env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

// FCM is only available in secure browser contexts with service workers
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export default app;
