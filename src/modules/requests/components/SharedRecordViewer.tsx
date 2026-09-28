import { useState, type ReactNode } from 'react';
import { X, FileDown, Loader2, Clock, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/useToast';
import { formatTimeLeft } from '@/lib/recordAccess';
import type { RecordAccessGrant } from '@/types/recordAccessGrant';
import type { WorkOrder } from '@/types/workOrder';
import type { Breakdown } from '@/types/breakdown';
import { fmtTs } from '../requestUi';

function text(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  return String(v).replace(/_/g, ' ');
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === '' || value === null || value === undefined) return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 py-1.5 sm:grid-cols-[180px_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-[#8BA3BF]">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm text-[#F0F4F8]">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5B8DEF]">{title}</h3>
      <dl className="divide-y divide-[#1E3A5F]/60">{children}</dl>
    </section>
  );
}

function Photos({ urls }: { urls: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer">
          <img src={u} alt="" className="h-20 w-20 rounded object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

function WorkOrderDetails({ wo }: { wo: WorkOrder }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`common.staffRequests.records.fields.${key}`);
  return (
    <div className="space-y-3">
      <Section title={k('overview')}>
        <Row label={k('type')} value={text(wo.woType)} />
        <Row label={k('priority')} value={text(wo.priority)} />
        <Row label={k('status')} value={text(wo.status)} />
        <Row label={k('machine')} value={[wo.machineName, wo.machineLocation].filter(Boolean).join(' · ')} />
        <Row label={k('department')} value={text(wo.machineDepartment)} />
        <Row label={k('description')} value={text(wo.description)} />
        <Row label={k('linkedBreakdown')} value={text(wo.linkedBreakdownTicketNumber)} />
        <Row label={k('createdAt')} value={fmtTs(wo.createdAt as Timestamp)} />
        <Row label={k('dueDate')} value={fmtTs(wo.dueDate)} />
      </Section>
      <Section title={k('people')}>
        <Row label={k('supervisor')} value={text(wo.supervisorInChargeName)} />
        <Row label={k('technicians')} value={text(wo.assignedTechnicianNames)} />
        <Row label={k('contractor')} value={text(wo.contractorCompanyName)} />
      </Section>
      <Section title={k('work')}>
        <Row label={k('start')} value={fmtTs(wo.actualStartTime)} />
        <Row label={k('end')} value={fmtTs(wo.actualEndTime)} />
        <Row label={k('duration')} value={wo.totalDurationMinutes != null ? `${wo.totalDurationMinutes} min` : ''} />
        <Row label={k('workDone')} value={text(wo.workDoneDescription)} />
        <Row label={k('rootCause')} value={[text(wo.rootCause), text(wo.rootCauseDescription)].filter(Boolean).join(' — ')} />
        <Row label={k('testRun')} value={[text(wo.testRunResult), text(wo.testRunNotes)].filter(Boolean).join(' — ')} />
        <Row label={k('machineAfter')} value={text(wo.machineStatusAfterRepair)} />
        {wo.checklist?.length > 0 && (
          <Row
            label={k('checklist')}
            value={
              <ol className="list-decimal space-y-0.5 pl-4">
                {wo.checklist.map((c) => (
                  <li key={c.stepNumber}>
                    {c.isCompleted ? '✓ ' : '○ '}
                    {c.stepDescription}
                    {c.actualValue != null ? ` — ${c.actualValue}${c.unit ? ` ${c.unit}` : ''}` : ''}
                  </li>
                ))}
              </ol>
            }
          />
        )}
        {wo.partsUsed?.length > 0 && (
          <Row
            label={k('partsUsed')}
            value={
              <ul className="space-y-0.5">
                {wo.partsUsed.map((p, i) => (
                  <li key={`${p.partName}-${i}`}>
                    {p.partName} × {p.quantity} {p.unit}
                  </li>
                ))}
              </ul>
            }
          />
        )}
        {wo.finalPhotos?.length > 0 && <Row label={k('photos')} value={<Photos urls={wo.finalPhotos} />} />}
        {wo.documents?.length > 0 && (
          <Row
            label={k('documents')}
            value={
              <ul className="flex flex-wrap gap-2">
                {wo.documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#93C5FD] hover:underline">
                      <Paperclip className="h-3.5 w-3.5" /> {d.name}
                    </a>
                  </li>
                ))}
              </ul>
            }
          />
        )}
      </Section>
      <Section title={k('signOff')}>
        <Row label={k('signedOffBy')} value={text(wo.supervisorSignOffByName)} />
        <Row label={k('signedOffAt')} value={fmtTs(wo.supervisorSignOffAt)} />
        <Row label={k('outcome')} value={[text(wo.signOffOutcome), text(wo.signOffOutcomeReason)].filter(Boolean).join(' — ')} />
        <Row label={k('notes')} value={text(wo.supervisorSignOffNotes)} />
      </Section>
    </div>
  );
}

function BreakdownDetails({ b }: { b: Breakdown }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`common.staffRequests.records.fields.${key}`);
  return (
    <div className="space-y-3">
      <Section title={k('overview')}>
        <Row label={k('status')} value={text(b.status)} />
        <Row label={k('severity')} value={text(b.severity)} />
        <Row label={k('type')} value={text(b.type)} />
        <Row label={k('machine')} value={[b.machineName, b.machineLocation].filter(Boolean).join(' · ')} />
        <Row label={k('department')} value={text(b.machineDepartment)} />
        <Row label={k('description')} value={text(b.description)} />
        <Row label={k('productionImpact')} value={text(b.productionImpact)} />
        <Row label={k('reportedAt')} value={fmtTs(b.reportedAt)} />
        <Row label={k('reportedBy')} value={text(b.reporterName)} />
        {b.photos?.length > 0 && <Row label={k('photos')} value={<Photos urls={b.photos} />} />}
      </Section>
      <Section title={k('response')}>
        <Row label={k('technicians')} value={text(b.assignedTechnicianNames)} />
        <Row label={k('attendedBy')} value={text(b.attendedByName)} />
        <Row label={k('findings')} value={text(b.technicianFindings)} />
        <Row label={k('repairStarted')} value={fmtTs(b.repairStartedAt)} />
        <Row label={k('resolvedAt')} value={fmtTs(b.resolvedAt)} />
        <Row label={k('closedAt')} value={fmtTs(b.closedAt)} />
        <Row label={k('hoursLost')} value={b.productionHoursLost != null ? String(b.productionHoursLost) : ''} />
      </Section>
      <Section title={k('resolution')}>
        <Row label={k('rootCause')} value={[text(b.rootCause), text(b.rootCauseDescription)].filter(Boolean).join(' — ')} />
        <Row label={k('correctiveActions')} value={text(b.correctiveActions)} />
        <Row label={k('preventive')} value={text(b.preventiveRecommendations)} />
        {b.resolutionPhotos?.length > 0 && <Row label={k('photos')} value={<Photos urls={b.resolutionPhotos} />} />}
      </Section>
    </div>
  );
}

/** Read-only view of a shared work order / breakdown snapshot. */
export default function SharedRecordViewer({ grant, onClose }: { grant: RecordAccessGrant; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const isWo = grant.recordType === 'work_order';
  const data = { ...grant.snapshot, id: grant.recordId };

  async function downloadPdf() {
    setExporting(true);
    try {
      const pdf = await import('@/utils/reports/pdf/maintenanceRecordPdf');
      if (isWo) await pdf.exportWorkOrderPdf(data as unknown as WorkOrder);
      else await pdf.exportBreakdownPdf(data as unknown as Breakdown);
    } catch (err) {
      console.error(err);
      toast.error(t('common.staffRequests.records.pdfFailed'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#1E3A5F] bg-[#0F1E35] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#1E3A5F] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[#F0F4F8]">
              {isWo ? t('common.staffRequests.records.workOrder') : t('common.staffRequests.records.breakdown')} {grant.recordNumber}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[#8BA3BF]">
              <Clock className="h-3.5 w-3.5" />
              {t('common.staffRequests.records.availableUntil', {
                date: fmtTs(grant.expiresAt),
                left: formatTimeLeft(grant.expiresAt),
              })}
              {' · '}
              {t('common.staffRequests.records.sharedBy', { name: grant.grantedByName })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-[#F0F4F8]" aria-label={t('common.staffRequests.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {grant.note && (
            <p className="rounded-lg border border-[#1A56DB]/40 bg-[#1A56DB]/10 px-3 py-2 text-sm text-[#D5DEEA]">{grant.note}</p>
          )}
          {isWo ? <WorkOrderDetails wo={data as unknown as WorkOrder} /> : <BreakdownDetails b={data as unknown as Breakdown} />}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#1E3A5F] px-5 py-3">
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E3A5F] px-3 py-2 text-sm font-medium text-[#B8C7DB] hover:border-[#2E5A8F] disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {t('common.staffRequests.records.downloadPdf')}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white">
            {t('common.staffRequests.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
