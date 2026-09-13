import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db, getMessagingInstance } from './firebase';

let foregroundListenerAttached = false;

/**
 * Requests notification permission and registers this device's FCM token
 * against the signed-in user, for every role — none of the Cloud Functions
 * that send notifications (PM overdue, low stock, contractor invoices,
 * triage escalation, training sign-off, etc.) filter by role; they just
 * multicast to whichever users are relevant to the event, reading the
 * `fcmToken` field off `users/{uid}` (functions/index.js sendPushToUsers
 * and friends). That field was never being written from the client, so
 * push notifications were silently inert for every user until now.
 *
 * Once permission is granted and a token is saved, notifications are
 * delivered by the browser/OS even when no FirmiCore tab is open or the
 * user has since signed out — see the onBackgroundMessage handler in
 * public/sw.js — because delivery happens through the persistent service
 * worker, not this page's JS. A device that has never opened the app and
 * granted permission at least once cannot receive anything; there's no way
 * around that browser/OS requirement.
 *
 * Safe to call on every login for every role: no-ops quietly if the
 * browser doesn't support the Push API, permission is denied, or no VAPID
 * key is configured.
 */
export async function initPushNotifications(uid: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return;
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return;

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    const messaging = await getMessagingInstance();
    if (!messaging) return;

    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return;

    await setDoc(doc(db, 'users', uid), { fcmToken: token }, { merge: true });

    if (!foregroundListenerAttached) {
      foregroundListenerAttached = true;
      // While a tab is open and focused, FCM delivers here instead of to
      // the service worker — surface it as an in-app toast so it isn't lost.
      onMessage(messaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'FirmiCore';
        const body = payload.notification?.body || payload.data?.body;
        toast.message(title, { description: body });
      });
    }
  } catch (err) {
    console.warn('Push notification setup failed', err);
  }
}
