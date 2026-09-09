import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ShiftTableRow } from './HandoverHistoryTable';
import { calculateLateStartMinutes, formatDuration } from '@/utils/handover.utils';
import { exportHandoverPdf } from '@/utils/reports/pdf/handoverPdf';
import HandoverStatusBadge from './HandoverStatusBadge';

interface HandoverHistoryCardProps {
  row: ShiftTableRow;
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '-';
  return d.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Covers both row kinds shown in the desktop table (a filed supervisor
// handover, or a plain completed shift session for any other role) — the
// mobile card list previously only rendered `handover` rows, so any role
// that ends a shift without filing a handover (technician, store keeper,
// operator…) silently had nothing to show on mobile even though the
// desktop table displayed them fine.
export function HandoverHistoryCard({ row }: HandoverHistoryCardProps) {
  const { t } = useTranslation();
  const lateMinutes = row.scheduledStart && row.start ? calculateLateStartMinutes(row.scheduledStart, row.start) : 0;
  const isLate = lateMinutes > 0;

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${isLate ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className=" font-bold text-slate-950">{row.shiftName}</h3>
          <p className="text-sm text-slate-500">
            {row.personName}
            {row.personRole && <span className="capitalize"> · {row.personRole.replace(/_/g, ' ')}</span>}
          </p>
          {row.department && <p className="text-xs text-slate-400">{row.department}</p>}
        </div>
        {row.handover ? <HandoverStatusBadge status={row.handover.status} /> : (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{t('common.shiftHandovers.historyCard.shiftLog')}</span>
        )}
      </div>
      <dl className="mt-3 grid gap-1 text-sm text-slate-600">
        <div>{t('common.shiftHandovers.historyCard.started', { time: fmtDateTime(row.start) })} {isLate && <span className="font-semibold text-red-600">{t('common.shiftHandovers.historyCard.late', { duration: formatDuration(lateMinutes * 60000) })}</span>}</div>
        <div>{t('common.shiftHandovers.historyCard.ended', { time: fmtDateTime(row.end) })}</div>
        <div>{t('common.shiftHandovers.historyCard.ot', { value: row.otMinutes != null ? formatDuration(row.otMinutes * 60000) : '-' })}</div>
        <div>{t('common.shiftHandovers.historyCard.watchFlags', { count: row.watchFlags.length })}</div>
        <div>{t('common.shiftHandovers.historyCard.breakdownsDuringShift', { count: row.ongoingBreakdowns.length })}</div>
        <div>{t('common.shiftHandovers.historyCard.wosDuringShift', { count: row.pendingWOs.length })}</div>
      </dl>
      {row.kind === 'handover' && row.handover && (
        <div className="mt-4 flex gap-2">
          <Link to={`/app/shift/handover/${row.handover.id}`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-bold text-white">{t('common.shiftHandovers.historyCard.viewArchive')}</Link>
          <button
            type="button"
            onClick={() => exportHandoverPdf(row.handover!)}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700"
          >
            {t('common.shiftHandovers.historyCard.export')}
          </button>
        </div>
      )}
    </article>
  );
}

export default HandoverHistoryCard;
