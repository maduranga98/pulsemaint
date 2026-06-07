import { useEffect, useState } from 'react';
import { fetchReportRows } from '../../services/reports.service';
import { resolveColumns, formatCell } from '../../utils/reports/reportColumns';
import type { ReportConfig, ReportType } from '../../types/reports.types';

interface ReportPreviewProps {
  reportType: ReportType;
  config: ReportConfig;
  companyId: string;
}

export default function ReportPreview({ reportType, config, companyId }: ReportPreviewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchReportRows(reportType, companyId, config)
        .then((data) => {
          if (cancelled) return;
          setTotal(data.length);
          setRows(data.slice(0, 8));
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load preview');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reportType, companyId, config]);

  const columns = rows[0] ? resolveColumns(reportType, rows).slice(0, 6) : [];

  return (
    <section className="space-y-2 border-b border-[#1E3A5F] pb-5">
      <div className="flex items-center justify-between">
        <h3 className="font-[Sora] text-sm font-semibold text-[#F0F4F8]">Report Preview</h3>
        {!loading && !error && <span className="text-xs text-[#8BA3BF]">{total} record(s)</span>}
      </div>

      {loading ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-[#1E3A5F] bg-[#0A1628] text-xs text-[#8BA3BF]">
          Loading preview…
        </div>
      ) : error ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-red-500/40 bg-[#0A1628] px-3 text-center text-xs text-red-300">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-[#1E3A5F] bg-[#0A1628] text-xs text-[#8BA3BF]">
          No records match the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1E3A5F] bg-[#0A1628]">
          <table className="w-full text-left text-[11px] text-[#C7D5E6]">
            <thead>
              <tr className="border-b border-[#1E3A5F] text-[#8BA3BF]">
                {columns.map((col) => (
                  <th key={col.key} className="whitespace-nowrap px-2 py-1.5 font-semibold">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-[#1E3A5F]/50 last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="max-w-[140px] truncate px-2 py-1.5">{String(formatCell(row[col.key], col.format))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {total > rows.length && (
            <p className="px-2 py-1.5 text-[10px] text-[#8BA3BF]">
              Showing first {rows.length} of {total} records. Export to see all.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
