import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface ShiftBriefingSectionProps {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function ShiftBriefingSection({ title, count, children, defaultOpen = false }: ShiftBriefingSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 text-left">
        <span className="font-[Sora] font-bold text-slate-950">{title} {typeof count === 'number' && <span className="text-slate-500">({count})</span>}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

export default ShiftBriefingSection;
