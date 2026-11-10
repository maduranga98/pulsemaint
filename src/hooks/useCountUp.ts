import { useEffect, useState } from 'react';

/** Counts a number up from 0 when it first shows (and eases to later changes). Skips the motion for reduced-motion users. */
export function useCountUp(target: number, ms = 900): number {
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(still ? target : 0);
  useEffect(() => {
    if (still || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const from = 0;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setValue(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, still]);
  return value;
}
