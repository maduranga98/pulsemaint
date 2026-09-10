import { ArrowLeft, Download, FileCheck, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getCategoryLabel,
  getFindingKindLabel,
  type AuditSession,
} from '../types/audit.types';
import { downloadAuditPdf } from '../utils/auditPdf';
import { AIRootCausePanel } from './AIRootCausePanel';

function useAnswerDisplay() {
  const { t } = useTranslation();
  return (value: string, answerType: string): string => {
    if (answerType === 'yes_no') {
      return value === 'yes'
        ? t('common.audit.answers.yes', 'Yes')
        : value === 'no'
          ? t('common.audit.answers.no', 'No')
          : '';
    }
    if (answerType === 'scale') return value ? `${value} / 5` : '';
    return value || '';
  };
}

export function AuditDetail({ session, onBack }: { session: AuditSession; onBack: () => void }) {
  const { t } = useTranslation();
  const answerDisplay = useAnswerDisplay();
  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> {t('common.audit.detail.backToHistory', 'Back to history')}
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white font-sora">
            {getCategoryLabel(session.category, session.templateName, t)}
          </h2>
          <p className="text-xs text-slate-400">{session.templateName} · {session.auditDate}</p>
        </div>
        {session.reportUrl ? (
          <a
            href={session.reportUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            <FileCheck className="h-4 w-4" /> {t('common.audit.detail.pdfReport', 'PDF Report')}
          </a>
        ) : (
          <button
            onClick={() => downloadAuditPdf(session, t)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            <Download className="h-4 w-4" /> {t('common.audit.detail.downloadPdf', 'Download PDF')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-sm">
        <UserCheck className="h-5 w-5 text-emerald-400" />
        <span className="text-slate-400">{t('common.audit.detail.conductedBy', 'Conducted by')} </span>
        <span className="text-white font-semibold">{session.auditorName}</span>
        <span className="text-slate-500">· {session.auditorRole}</span>
        <span className="ml-auto text-white font-bold">{session.score}%</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label={t('common.audit.detail.department', 'Department')} value={session.department || ''} />
        <Info label={t('common.audit.detail.locationZone', 'Location / Zone')} value={session.location || ''} />
        {session.category === 'contractor' ? (
          <Info label={t('common.audit.detail.contractors', 'Contractors')} value={(session.contractors ?? []).map((c) => c.name).join(', ') || ''} />
        ) : (
          <Info label={t('common.audit.detail.machines', 'Machines')} value={session.machines.map((m) => m.name).join(', ') || ''} />
        )}
        <Info label={t('common.audit.detail.participants', 'Participants')} value={session.participants.map((p) => p.name).join(', ') || ''} />
      </div>

      <Section title={t('common.audit.detail.checklistResponses', 'Checklist Responses')}>
        <div className="divide-y divide-slate-800">
          {session.answers.map((a) => (
            <div key={a.taskId} className="py-2 flex items-start justify-between gap-3">
              <span className="text-sm text-slate-300">{a.taskText}</span>
              <span className={`text-sm font-medium shrink-0 ${a.failed ? 'text-red-400' : 'text-white'}`}>
                {answerDisplay(a.value, a.answerType)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {session.findings.length > 0 && (
        <Section title={t('common.audit.detail.findings', 'Findings')}>
          <div className="space-y-2">
            {session.findings.map((f) => (
              <div key={f.id} className="p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm">
                <span className="px-2 py-0.5 text-xs bg-amber-900/40 border border-amber-700/50 text-amber-200 rounded">
                  {getFindingKindLabel(f.kind, t)}
                </span>
                <p className="text-white mt-1.5">{f.description}</p>
                <p className="text-slate-400 text-xs mt-1"><b>{t('common.audit.detail.reason', 'Reason:')}</b> {f.reason || ''}</p>
                <p className="text-slate-400 text-xs"><b>{t('common.audit.detail.solution', 'Solution:')}</b> {f.solution || ''}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {session.attachments.length > 0 && (
        <Section title={t('common.audit.detail.attachments', 'Attachments')}>
          <ul className="space-y-1">
            {session.attachments.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-blue-300 hover:underline">
                  {a.type}: {a.name}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('common.audit.detail.aiRootCauseAnalysis', 'AI Root-Cause Analysis')}>
        <AIRootCausePanel suggestions={session.aiSuggestions} />
      </Section>
    </div>
  );
}

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="p-3 bg-slate-800/40 border border-slate-700 rounded-lg">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-sm text-white mt-0.5">{value}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
    <h3 className="text-sm font-bold text-white font-sora mb-3">{title}</h3>
    {children}
  </div>
);
