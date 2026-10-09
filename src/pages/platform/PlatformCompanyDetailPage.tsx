import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Copy, X, XCircle } from 'lucide-react';
import {
  platformService, errorText,
  type CompanyAction, type Cycle, type PlanId, type PlatformCompanyDetail, type PlatformUser, type ReminderKind, type UserAction,
} from '@/services/platformService';
import { Badge, Card, ErrorNote, Loading, PageHeader, PLAN_NAMES, btn, fmtDate, fmtDateTime, fmtMoney, input, relDays, statusTone } from './platformUi';
import RejectCompanyDialog from './RejectCompanyDialog';

type Prompt =
  | { kind: 'password'; user: PlatformUser }
  | { kind: 'email'; user: PlatformUser }
  | { kind: 'trial' }
  | { kind: 'plan' }
  | { kind: 'note' };

export default function PlatformCompanyDetailPage() {
  const { companyId = '' } = useParams();
  const [data, setData] = useState<PlatformCompanyDetail | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof platformService.auditLog>>['entries']>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [value, setValue] = useState('');
  const [plan, setPlan] = useState<PlanId>('starter');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [resetLink, setResetLink] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(() => {
    platformService.getCompany(companyId).then((d) => {
      setData(d);
      setPlan(d.company.plan);
      setCycle(d.company.billingCycle);
    }).catch((e) => setError(errorText(e, 'Could not load the company')));
    platformService.auditLog(companyId).then((r) => setAudit(r.entries)).catch(() => {});
  }, [companyId]);

  useEffect(load, [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(label);
      setPrompt(null);
      load();
    } catch (e) {
      setError(errorText(e, 'Action failed'));
    } finally {
      setBusy(false);
    }
  }

  const company = (change: CompanyAction, label: string) => run(label, () => platformService.updateCompany(companyId, change));
  const user = (u: PlatformUser, change: UserAction, label: string) => run(label, () => platformService.manageUser(companyId, u.uid, change));

  async function makeResetLink(u: PlatformUser) {
    setBusy(true);
    setError('');
    try {
      const res = await platformService.manageUser(companyId, u.uid, { action: 'resetLink' });
      setResetLink(res.link ?? '');
    } catch (e) {
      setError(errorText(e, 'Could not create a reset link'));
    } finally {
      setBusy(false);
    }
  }

  function sendReminder(kind: ReminderKind) {
    void run('Reminder emailed to the company admin', () => platformService.sendReminder(companyId, kind));
  }

  function openPrompt(p: Prompt) {
    setPrompt(p);
    setValue(p.kind === 'email' ? p.user.email ?? '' : p.kind === 'note' ? data?.company.platformNote ?? '' : p.kind === 'trial' ? '14' : '');
  }

  if (!data) return error ? <ErrorNote message={error} /> : <Loading />;
  const c = data.company;
  const sub = data.stripe.subscription;

  return (
    <div className="space-y-6">
      <Link to="/platform/companies" className="inline-flex items-center gap-1.5 text-sm text-blue-300! hover:underline"><ArrowLeft className="h-4 w-4" /> Companies</Link>
      <PageHeader
        title={c.name}
        subtitle={`${c.country ?? '—'} · ${c.industry ?? '—'} · registered ${fmtDate(c.createdAt)} · ${c.userCount} users · ID ${c.id}`}
        actions={<div className="flex flex-wrap gap-2"><Badge tone={statusTone(c.approvalStatus)}>{c.approvalStatus}</Badge><Badge tone={statusTone(c.status)}>access: {c.status}</Badge>{c.subscriptionStatus && <Badge tone={statusTone(c.subscriptionStatus)}>stripe: {c.subscriptionStatus}</Badge>}</div>}
      />
      {error && <ErrorNote message={error} />}
      {notice && <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">{notice}</div>}

      {c.approvalStatus !== 'approved' && (
        <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${c.approvalStatus === 'pending' ? 'border-amber-600/50 bg-amber-950/30' : 'border-red-700/50 bg-red-950/30'}`}>
          <div className="flex items-start gap-3">
            {c.approvalStatus === 'pending' ? <Clock className="mt-0.5 h-5 w-5 text-amber-300" /> : <XCircle className="mt-0.5 h-5 w-5 text-red-300" />}
            <div>
              <p className="font-semibold text-white">{c.approvalStatus === 'pending' ? 'Waiting for your approval' : 'Registration rejected'}</p>
              <p className="text-sm text-slate-300">
                {c.approvalStatus === 'pending'
                  ? `Registered ${fmtDateTime(c.createdAt)} by ${c.adminName ?? 'the admin'}${c.adminEmail ? ` (${c.adminEmail})` : ''}. Nobody can use FirmiCore until you approve it; the 30-day trial starts on approval.`
                  : c.rejectionReason ? `Reason: ${c.rejectionReason}` : 'No reason recorded.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={`${btn.primary} inline-flex items-center gap-1.5`} disabled={busy} onClick={() => void company({ action: 'approve' }, 'Company approved — the admin can sign in now and has been emailed')}>
              <Check className="h-4 w-4" /> Approve
            </button>
            {c.approvalStatus === 'pending' && (
              <button className={`${btn.danger} inline-flex items-center gap-1.5`} disabled={busy} onClick={() => setRejecting(true)}>
                <X className="h-4 w-4" /> Reject
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Subscription & access">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-400">Plan</dt><dd>{PLAN_NAMES[c.plan] ?? c.plan} · {c.billingCycle}</dd>
            <dt className="text-slate-400">Admin</dt><dd>{c.adminName ?? '—'}<br /><span className="text-xs text-slate-500">{c.adminEmail}</span></dd>
            {c.status === 'trial' ? (
              <><dt className="text-slate-400">Trial ends</dt><dd>{fmtDate(c.trialEndsAt)} <span className="text-xs text-slate-500">{relDays(c.trialEndsAt)}</span></dd></>
            ) : c.planSetBy === 'platform' && !c.hasSubscription ? (
              <><dt className="text-slate-400">Subscription</dt><dd>Assigned by Lumora — full {PLAN_NAMES[c.plan] ?? c.plan} access and limits, no trial</dd></>
            ) : null}
            <dt className="text-slate-400">Stripe</dt>
            <dd>
              {sub ? <>{sub.amount != null && sub.currency ? fmtMoney(sub.amount, sub.currency) : ''} / {sub.interval} · {sub.status}<br />
                <span className="text-xs text-slate-500">{sub.cancelAtPeriodEnd ? 'ends' : 'renews'} {fmtDate(sub.currentPeriodEnd)} ({relDays(sub.currentPeriodEnd)})</span></> : 'No subscription'}
            </dd>
            <dt className="text-slate-400">Last reminder</dt><dd>{fmtDateTime(c.lastReminderAt)}</dd>
            <dt className="text-slate-400">Internal note</dt><dd className="whitespace-pre-wrap">{c.platformNote ?? '—'}</dd>
          </dl>
          {data.stripe.error && <p className="mt-3 text-xs text-red-300">{data.stripe.error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {c.status === 'suspended'
              ? <button className={btn.primary} disabled={busy} onClick={() => void company({ action: 'reactivate' }, 'Access restored for all users')}>Restore access</button>
              : <button className={btn.danger} disabled={busy} onClick={() => window.confirm(`Suspend access for every user of ${c.name}? Data is kept.`) && void company({ action: 'suspend' }, 'Company suspended')}>Suspend access</button>}
            {(c.status === 'trial' || (c.status === 'suspended' && !c.hasSubscription && c.planSetBy !== 'platform')) && (
              <button className={btn.ghost} disabled={busy} onClick={() => openPrompt({ kind: 'trial' })}>Extend trial</button>
            )}
            <button className={btn.ghost} disabled={busy} onClick={() => openPrompt({ kind: 'plan' })}>Set plan manually</button>
            {sub && (sub.cancelAtPeriodEnd
              ? <button className={btn.ghost} disabled={busy} onClick={() => void company({ action: 'resumeSubscription' }, 'Subscription resumed')}>Resume subscription</button>
              : <button className={btn.danger} disabled={busy} onClick={() => window.confirm('Cancel this subscription at the end of the paid period?') && void company({ action: 'cancelSubscription' }, 'Subscription will end at the period end')}>Cancel at period end</button>)}
            <button className={btn.ghost} disabled={busy} onClick={() => openPrompt({ kind: 'note' })}>Internal note</button>
          </div>
        </Card>

        <Card title="Payment reminders" actions={<span className="text-xs text-slate-500">Emails the company admin</span>}>
          <div className="flex flex-wrap gap-2">
            <button className={btn.ghost} disabled={busy} onClick={() => sendReminder('paymentFailed')}>Payment failed</button>
            <button className={btn.ghost} disabled={busy} onClick={() => sendReminder('renewalDue')}>Renewal coming up</button>
            <button className={btn.ghost} disabled={busy} onClick={() => sendReminder('trialEnding')}>Trial ending</button>
            <button className={btn.ghost} disabled={busy} onClick={() => sendReminder('trialExpired')}>Trial ended</button>
            <button className={btn.ghost} disabled={busy} onClick={() => sendReminder('cancelling')}>Subscription ending</button>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-white!">Invoices</h3>
          {data.stripe.invoices.length === 0 ? <p className="text-sm text-slate-400">No invoices.</p> : (
            <ul className="divide-y divide-[#1E3A5F] text-sm">
              {data.stripe.invoices.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{fmtDate(i.created)} · {i.number ?? i.id}</span>
                  <span className="flex items-center gap-2">
                    {fmtMoney(i.total, i.currency)} <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                    {i.hostedInvoiceUrl && <a href={i.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-blue-300! hover:underline">View</a>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={`Users & login (${data.users.length})`}>
        {resetLink && (
          <div className="mb-4 rounded-lg border border-blue-700/50 bg-blue-900/20 p-3 text-sm">
            <p className="mb-1 text-blue-200">Password reset link (share it with the user securely; it expires):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-slate-300">{resetLink}</code>
              <button className={btn.ghost} onClick={() => void navigator.clipboard.writeText(resetLink)}><Copy className="h-4 w-4" /></button>
              <button className={btn.ghost} onClick={() => setResetLink('')}>Hide</button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="py-2 pr-3">User</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Login</th><th className="py-2 pr-3">Last sign-in</th><th className="py-2">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {data.users.map((u) => (
                <tr key={u.uid}>
                  <td className="py-2 pr-3"><p className="text-white">{u.fullName ?? '—'} {u.isCompanyAdmin && <Badge tone="violet">owner</Badge>}</p><p className="text-xs text-slate-500">{u.email ?? u.phone ?? u.uid}</p></td>
                  <td className="py-2 pr-3">{u.role}</td>
                  <td className="py-2 pr-3">{u.disabled ? <Badge tone="red">disabled</Badge> : <Badge tone={statusTone(u.status)}>{u.status ?? '—'}</Badge>}<p className="text-xs text-slate-500">{u.loginMethod}</p></td>
                  <td className="py-2 pr-3">{fmtDateTime(u.lastSignInAt)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button className={btn.ghost} disabled={busy || !u.email} onClick={() => void makeResetLink(u)}>Reset link</button>
                      <button className={btn.ghost} disabled={busy} onClick={() => openPrompt({ kind: 'password', user: u })}>Set password</button>
                      <button className={btn.ghost} disabled={busy} onClick={() => openPrompt({ kind: 'email', user: u })}>Change email</button>
                      {u.disabled
                        ? <button className={btn.ghost} disabled={busy} onClick={() => void user(u, { action: 'enable' }, 'Login enabled')}>Enable</button>
                        : <button className={btn.danger} disabled={busy} onClick={() => window.confirm(`Disable login for ${u.fullName ?? u.email}?`) && void user(u, { action: 'disable' }, 'Login disabled')}>Disable</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Requests from this company">
          {data.requests.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
            <ul className="space-y-2 text-sm">
              {data.requests.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2">
                  <Link to={`/platform/requests/${r.id}`} className="text-blue-300! hover:underline">{r.subject}</Link>
                  <span className="flex gap-2"><Badge>{r.type}</Badge><Badge tone={statusTone(r.status)}>{r.status}</Badge></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Activity log">
          {audit.length === 0 ? <p className="text-sm text-slate-400">No superadmin actions yet.</p> : (
            <ul className="space-y-1.5 text-sm">
              {audit.map((a) => <li key={a.id} className="flex justify-between gap-2"><span>{a.action}</span><span className="text-xs text-slate-500">{a.actorEmail} · {fmtDateTime(a.createdAt)}</span></li>)}
            </ul>
          )}
        </Card>
      </div>

      {rejecting && (
        <RejectCompanyDialog
          companyName={c.name}
          busy={busy}
          onCancel={() => setRejecting(false)}
          onConfirm={(reason) => void company({ action: 'reject', reason }, 'Registration rejected — the admin has been emailed').then(() => setRejecting(false))}
        />
      )}

      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-6">
            <h3 className="text-base font-semibold text-white!">
              {prompt.kind === 'password' && `Set a new password for ${prompt.user.fullName ?? prompt.user.email}`}
              {prompt.kind === 'email' && `Change sign-in email for ${prompt.user.fullName ?? prompt.user.uid}`}
              {prompt.kind === 'trial' && 'Extend the trial by (days)'}
              {prompt.kind === 'plan' && 'Set plan manually'}
              {prompt.kind === 'note' && 'Internal note (only superadmins see this)'}
            </h3>
            {prompt.kind === 'plan' ? (
              <div className="space-y-3">
                <select className={input} value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
                  {Object.entries(PLAN_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select className={input} value={cycle} onChange={(e) => setCycle(e.target.value as Cycle)}>
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select>
                <p className="text-xs text-slate-400">For contracts billed outside Stripe (e.g. Enterprise). This <strong>ends the trial</strong>: the company gets this plan's full features and limits right away. A Stripe subscription change will overwrite it.</p>
              </div>
            ) : prompt.kind === 'note' ? (
              <textarea className={`${input} h-32`} value={value} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input
                className={input}
                type={prompt.kind === 'password' ? 'text' : prompt.kind === 'trial' ? 'number' : 'email'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={prompt.kind === 'password' ? 'At least 8 characters' : ''}
                autoFocus
              />
            )}
            {prompt.kind === 'password' && <p className="text-xs text-slate-400">The user is signed out everywhere and must use the new password.</p>}
            <div className="flex justify-end gap-2">
              <button className={btn.ghost} onClick={() => setPrompt(null)}>Cancel</button>
              <button
                className={btn.primary}
                disabled={busy}
                onClick={() => {
                  if (prompt.kind === 'password') void user(prompt.user, { action: 'setPassword', password: value }, 'Password updated');
                  if (prompt.kind === 'email') void user(prompt.user, { action: 'updateEmail', email: value }, 'Sign-in email updated');
                  if (prompt.kind === 'trial') void company({ action: 'extendTrial', days: Number(value) }, 'Trial extended');
                  if (prompt.kind === 'plan') void company({ action: 'setPlan', plan, billingCycle: cycle }, 'Plan assigned — trial ended, the company now has full access on this plan');
                  if (prompt.kind === 'note') void company({ action: 'note', text: value }, 'Note saved');
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
