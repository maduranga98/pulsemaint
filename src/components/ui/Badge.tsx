import type { ReactNode } from 'react';

type Tone = 'neutral' | 'indigo' | 'green' | 'amber' | 'red' | 'blue';

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const tones: Record<Tone, { bg: string; text: string; dot: string; border: string }> = {
  neutral: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', border: 'border-slate-200' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-100' },
  green:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-100' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-100' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-100' },
};

export function Badge({ tone = 'neutral', children, className = '', dot = false }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${t.bg} ${t.text} ${t.border} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
      {children}
    </span>
  );
}
