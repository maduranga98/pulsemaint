import type { ReactNode } from 'react';

interface KpiStripProps {
  children: ReactNode;
}

export default function KpiStrip({ children }: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {children}
    </div>
  );
}
