import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/platform/leads';

/** Column header / badge colours per pipeline stage. */
export const STATUS_STYLE: Record<LeadStatus, { header: string; badge: string }> = {
  new: { header: 'bg-slate-600', badge: 'bg-slate-700 text-slate-200' },
  called: { header: 'bg-sky-600', badge: 'bg-sky-900/60 text-sky-200' },
  not_answered: { header: 'bg-zinc-500', badge: 'bg-zinc-700 text-zinc-200' },
  follow_up: { header: 'bg-cyan-700', badge: 'bg-cyan-900/60 text-cyan-200' },
  demo_booked: { header: 'bg-violet-600', badge: 'bg-violet-900/60 text-violet-200' },
  demo_done: { header: 'bg-fuchsia-600', badge: 'bg-fuchsia-900/60 text-fuchsia-200' },
  negotiation: { header: 'bg-amber-600', badge: 'bg-amber-900/60 text-amber-200' },
  closed_won: { header: 'bg-emerald-600', badge: 'bg-emerald-900/60 text-emerald-200' },
  closed_lost: { header: 'bg-red-700', badge: 'bg-red-900/60 text-red-200' },
};

export function StatusPill({ status }: { status: LeadStatus }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status].badge}`}>{LEAD_STATUS_LABEL[status]}</span>;
}

const TAG_STYLE: Record<string, string> = {
  Feature: 'border-sky-600/60 text-sky-300',
  Bug: 'border-red-600/60 text-red-300',
  Complaint: 'border-amber-600/60 text-amber-300',
  Hot: 'border-orange-500/60 text-orange-300',
  Price: 'border-emerald-600/60 text-emerald-300',
};

export function TagChip({ tag }: { tag: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-px text-[10px] font-semibold ${TAG_STYLE[tag] ?? 'border-slate-600 text-slate-300'}`}>{tag}</span>;
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`flex max-h-[94vh] w-full flex-col rounded-xl border border-[#1E3A5F] bg-[#0F1E35] ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between border-b border-[#1E3A5F] px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white!">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#1E3A5F] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ms → value for <input type="datetime-local"> (local time). */
export function toLocalInput(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/** ms → value for <input type="date">. */
export function toDateInput(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInput(v: string): number | null {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  return y ? new Date(y, m - 1, d).getTime() : null;
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  // BOM so Excel opens Sinhala/Tamil text correctly.
  const blob = new Blob(['﻿', text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Relative "in 3 h" / "2 d ago" label for scheduled things. */
export function whenLabel(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const v = abs < 3_600_000 ? `${Math.max(1, Math.round(abs / 60_000))} min` : abs < 86_400_000 ? `${Math.round(abs / 3_600_000)} h` : `${Math.round(abs / 86_400_000)} d`;
  return diff >= 0 ? `in ${v}` : `${v} ago`;
}
