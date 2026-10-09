import type { ReactNode } from 'react';

/** Small shared pieces for the platform console (internal Lumora Ventures tool, English only). */

export function fmtDate(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function fmtDateTime(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function fmtMoney(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export function relDays(ms: number | null | undefined): string {
  if (!ms) return '';
  const d = Math.round((ms - Date.now()) / 86_400_000);
  if (d === 0) return 'today';
  return d > 0 ? `in ${d} day${d === 1 ? '' : 's'}` : `${-d} day${d === -1 ? '' : 's'} ago`;
}

export const PLAN_NAMES: Record<string, string> = { starter: 'Basic', workshop: 'Workshop', factory: 'Factory Pro', enterprise: 'Enterprise' };

const TONES = {
  green: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  amber: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  red: 'bg-red-900/40 text-red-300 border-red-700/50',
  blue: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  slate: 'bg-slate-800 text-slate-300 border-slate-600',
  violet: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONES[tone]}`}>{children}</span>;
}

export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'active': case 'paid': case 'resolved': case 'approved': return 'green';
    case 'pending': return 'amber';
    case 'rejected': return 'red';
    case 'trial': case 'trialing': case 'in_progress': case 'open': return 'blue';
    case 'past_due': case 'unpaid': case 'uncollectible': case 'suspended': case 'high': return 'red';
    case 'medium': case 'canceled': return 'amber';
    default: return 'slate';
  }
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-white!">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'red' | 'amber' | 'green' }) {
  const color = tone === 'red' ? 'text-red-300' : tone === 'amber' ? 'text-amber-300' : tone === 'green' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white!">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300 break-words">{message}</div>;
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-slate-400">Loading…</p>;
}

export const btn = {
  primary: 'rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white! hover:bg-blue-500 disabled:opacity-50',
  ghost: 'rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50',
  danger: 'rounded-lg border border-red-700/60 bg-red-900/30 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-900/50 disabled:opacity-50',
};

export const input = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none';
