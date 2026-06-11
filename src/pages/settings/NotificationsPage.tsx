import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Bell, Save } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import {
  NOTIFICATION_EVENTS,
  withDefaults,
  type NotificationPrefs,
  type NotificationChannel,
  type NotificationEventType,
} from '../../types/notificationPrefs';

export default function NotificationsPage() {
  const userId = useAuthStore((s) => s.userProfile?.id);
  const [prefs, setPrefs] = useState<NotificationPrefs>(withDefaults(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (cancelled) return;
        setPrefs(withDefaults(snap.data()?.notificationPrefs));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function toggle(event: NotificationEventType, channel: NotificationChannel) {
    setPrefs((prev) => ({
      ...prev,
      [event]: { ...prev[event], [channel]: !prev[event][channel] },
    }));
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), { notificationPrefs: prefs });
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Choose how you want to be notified for each event.</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <Bell className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Event Notifications</h2>
          </div>

          {loading ? (
            <p className="px-5 py-8 text-sm text-slate-400">Loading preferences…</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-center w-24">Push</th>
                  <th className="px-4 py-3 text-center w-24">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {NOTIFICATION_EVENTS.map((def) => (
                  <tr key={def.type}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{def.label}</span>
                        {def.highSeverity && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 uppercase">
                            High
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{def.description}</p>
                    </td>
                    {(['push', 'email'] as NotificationChannel[]).map((ch) => (
                      <td key={ch} className="px-4 py-3 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={prefs[def.type][ch]}
                          onClick={() => toggle(def.type, ch)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            prefs[def.type][ch] ? 'bg-blue-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              prefs[def.type][ch] ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          In-app inbox notifications are always shown. These settings control push and email delivery.
        </p>
      </div>
    </div>
  );
}
