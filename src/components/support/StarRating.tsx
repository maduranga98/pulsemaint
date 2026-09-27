import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number | null | undefined;
  /** Omit for a read-only display. */
  onChange?: (value: number | null) => void;
  size?: number;
  /** Accessible label per star, e.g. (n) => `${n} of 5 stars`. */
  label?: (n: number) => string;
}

/** 1–5 star rating: interactive when onChange is given, otherwise display only. */
export default function StarRating({ value, onChange, size = 20, label = (n) => `${n}/5` }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const interactive = !!onChange;

  return (
    <div className="inline-flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'} aria-label={value ? label(value) : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown;
        const star = <Star style={{ width: size, height: size }} className={filled ? 'fill-amber-400 text-amber-400' : 'text-slate-500'} />;
        return interactive ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={label(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange?.(value === n ? null : n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
