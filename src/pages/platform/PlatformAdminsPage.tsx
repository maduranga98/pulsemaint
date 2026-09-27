import { useCallback, useEffect, useState } from 'react';
import { platformService, errorText } from '@/services/platformService';
import { useSuperadmin } from '@/lib/platform/useSuperadmin';
import { Card, ErrorNote, PageHeader, btn, fmtDate, input } from './platformUi';

export default function PlatformAdminsPage() {
  const { email: me } = useSuperadmin();
  const [admins, setAdmins] = useState<Awaited<ReturnType<typeof platformService.listSuperadmins>>['admins']>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    platformService.listSuperadmins().then((r) => setAdmins(r.admins)).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  async function change(target: string, enabled: boolean) {
    setBusy(true);
    setError('');
    try {
      await platformService.setSuperadmin(target, enabled);
      setEmail('');
      load();
    } catch (e) {
      setError(errorText(e, 'Could not update superadmin access'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Superadmins" subtitle="Lumora Ventures staff with access to this console. They must already have a FirmiCore login." />
      {error && <ErrorNote message={error} />}
      <Card title="Add a superadmin">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void change(email, true); }}>
          <input className={`${input} max-w-sm`} type="email" required placeholder="name@lumoraventures.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={btn.primary} disabled={busy}>Grant access</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">The person signs out and in again (or reloads the console) to pick up the access.</p>
      </Card>
      <Card title={`Current superadmins (${admins.length})`}>
        <ul className="divide-y divide-[#1E3A5F] text-sm">
          {admins.map((a) => (
            <li key={a.uid} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><span className="text-white">{a.email ?? a.uid}</span> <span className="text-xs text-slate-500">since {fmtDate(a.grantedAt)}</span></span>
              {a.email && a.email !== me && (
                <button className={btn.danger} disabled={busy} onClick={() => window.confirm(`Remove superadmin access for ${a.email}?`) && void change(a.email!, false)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
