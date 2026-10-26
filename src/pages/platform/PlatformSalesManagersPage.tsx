import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Trash2, UserPlus, UserX, UserCheck } from 'lucide-react';
import { platformService, errorText, type SalesManager } from '@/services/platformService';
import { Badge, fmtDateTime } from './platformUi';

const input = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-white outline-none focus:border-blue-500';
const btn = 'inline-flex items-center gap-1.5 rounded-md border border-[#1E3A5F] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-[#142849] disabled:opacity-50';

/**
 * Superadmin only: create the logins of Lumora sales managers. They sign in at
 * /platform/login and see only the Sales part of this console.
 */
export default function PlatformSalesManagersPage() {
  const [rows, setRows] = useState<SalesManager[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const load = useCallback(async () => {
    try {
      setRows((await platformService.listSalesManagers()).managers);
    } catch (e) {
      setError(errorText(e, 'Could not load sales managers'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await platformService.createSalesManager({ name, email, password });
      setNotice(`Login created for ${email}. Give them the email and password and the sign-in page: ${window.location.origin}/platform/login`);
      setName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not create the sales manager'));
    } finally {
      setBusy(false);
    }
  }

  async function act(m: SalesManager, change: Parameters<typeof platformService.manageSalesManager>[1]) {
    setError('');
    setNotice('');
    try {
      await platformService.manageSalesManager(m.uid, change);
      setNotice(change.action === 'setPassword' ? `Password changed for ${m.email}.` : 'Done.');
      await load();
    } catch (err) {
      setError(errorText(err, 'Action failed'));
    }
  }

  function changePassword(m: SalesManager) {
    const pw = window.prompt(`New password for ${m.email} (at least 8 characters)`);
    if (pw) void act(m, { action: 'setPassword', password: pw });
  }

  function remove(m: SalesManager) {
    if (window.confirm(`Delete the login of ${m.name ?? m.email}? This cannot be undone.`)) void act(m, { action: 'remove' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white!">Sales managers</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sales managers sign in at <span className="text-slate-300">/platform/login</span> and see only Leads, Calls, Feature requests and To-Do (with trial requests under Leads).
        </p>
      </div>

      {error && <p className="rounded-md border border-red-700/50 bg-red-900/30 p-3 text-sm text-red-200 break-words">{error}</p>}
      {notice && <p className="rounded-md border border-emerald-700/50 bg-emerald-900/30 p-3 text-sm text-emerald-200 break-words">{notice}</p>}

      <form onSubmit={(e) => void create(e)} className="grid gap-3 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input className={input} placeholder="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="text" placeholder="Password (min 8)" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white! hover:bg-blue-500 disabled:opacity-60">
          <UserPlus className="h-4 w-4" /> {busy ? 'Creating…' : 'Create login'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[#1E3A5F] bg-[#0F1E35]">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Last sign-in</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows === null && <tr><td className="p-3 text-slate-400" colSpan={5}>Loading…</td></tr>}
            {rows?.length === 0 && <tr><td className="p-3 text-slate-400" colSpan={5}>No sales managers yet.</td></tr>}
            {rows?.map((m) => (
              <tr key={m.uid} className="border-t border-[#1E3A5F]">
                <td className="p-3 text-white">{m.name ?? '—'}</td>
                <td className="p-3">{m.email ?? '—'}</td>
                <td className="p-3">{m.disabled ? <Badge tone="red">Disabled</Badge> : <Badge tone="green">Active</Badge>}</td>
                <td className="p-3 text-slate-400">{fmtDateTime(m.lastSignInAt)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className={btn} onClick={() => changePassword(m)}><KeyRound className="h-3.5 w-3.5" /> Password</button>
                    {m.disabled
                      ? <button className={btn} onClick={() => void act(m, { action: 'enable' })}><UserCheck className="h-3.5 w-3.5" /> Enable</button>
                      : <button className={btn} onClick={() => void act(m, { action: 'disable' })}><UserX className="h-3.5 w-3.5" /> Disable</button>}
                    <button className={`${btn} text-red-300`} onClick={() => remove(m)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
