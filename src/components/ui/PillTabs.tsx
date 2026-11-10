import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface PillTab<T extends string> {
  id: T;
  label: ReactNode;
  /** A count shown in a small badge after the label. */
  count?: number;
}

interface PillTabsProps<T extends string> {
  tabs: PillTab<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
}

/** Tabs on a pill track; a highlight slides to the selected tab. */
export function PillTabs<T extends string>({ tabs, value, onChange, ariaLabel, className = '' }: PillTabsProps<T>) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);

  const measure = () => {
    const el = refs.current.get(value);
    setInk(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  };
  useLayoutEffect(measure, [value, tabs.length, tabs.map((t) => String(t.count ?? '')).join('|')]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  return (
    <div role="tablist" aria-label={ariaLabel} className={`pill-tabs ${className}`}>
      {ink && <span className="pill-ink" style={{ transform: `translateX(${ink.left}px)`, width: ink.width }} />}
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (el) refs.current.set(tab.id, el);
            else refs.current.delete(tab.id);
          }}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={`pill-tab ${tab.id === value ? 'is-on' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="pill-tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
