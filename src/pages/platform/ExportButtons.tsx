import { useState } from 'react';
import { Download } from 'lucide-react';
import { toCsv } from '@/lib/platform/leads';
import { downloadText } from './leads/leadUi';
import { btn } from './platformUi';

export type ExportCell = string | number | null | undefined;

/** "CSV" and "Excel" download buttons for a table (exports exactly the rows passed — i.e. the current filters). */
export default function ExportButtons({ filename, header, rows, sheetName = 'Export' }: {
  filename: string;
  header: string[];
  rows: () => ExportCell[][];
  sheetName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);

  function csv() {
    downloadText(`${filename}-${stamp}.csv`, toCsv(header, rows()));
  }

  async function excel() {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows().map((r) => r.map((c) => c ?? ''))]);
      ws['!cols'] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      XLSX.writeFile(wb, `${filename}-${stamp}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button className={`${btn.ghost} inline-flex items-center gap-1.5`} onClick={csv}><Download className="h-4 w-4" /> CSV</button>
      <button className={`${btn.ghost} inline-flex items-center gap-1.5`} disabled={busy} onClick={() => void excel()}><Download className="h-4 w-4" /> {busy ? '…' : 'Excel'}</button>
    </div>
  );
}
