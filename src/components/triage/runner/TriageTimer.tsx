import { useState, useEffect } from 'react';

interface Props {
  startedAt: number; // Unix seconds
}

export default function TriageTimer({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(Math.floor(Date.now() / 1000) - startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <span className="font-mono text-sm font-medium text-white/90">
      {mm}:{ss}
    </span>
  );
}
