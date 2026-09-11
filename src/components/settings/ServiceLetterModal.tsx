import { useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import type { TFunction } from 'i18next';
import { X, FileText, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { UserProfile, UserRole } from '@/types/auth';
import { generateServiceLetter } from '@/lib/serviceLetter/serviceLetter';
import { pdfSafeText } from '@/utils/reports/pdf/pdfFonts';
import { SignaturePad } from './SignaturePad';

interface ServiceLetterModalProps {
  users: UserProfile[];
  roleLabels: Record<UserRole, string>;
  onClose: () => void;
}

function timestampToDate(ts: unknown): Date | null {
  const t = ts as { toDate?: () => Date; seconds?: number } | null | undefined;
  if (!t) return null;
  return t.toDate ? t.toDate() : t.seconds ? new Date(t.seconds * 1000) : null;
}

// Builds the default letter body either via a real translator (`t`) or via
// `englishOnly`, a stand-in that always returns its `defaultValue` — used to
// derive the guaranteed-English fallback text below.
function buildDefaultBody(
  employee: UserProfile,
  roleLabel: string,
  companyName: string,
  translate: (key: string, defaultValue: string, vars?: Record<string, unknown>) => string,
): string {
  const joined = timestampToDate(employee.createdAt);
  const joinedText = joined
    ? joined.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : translate('common.settings.serviceLetter.defaultBodyJoinedFallback', 'their date of joining');
  const departmentClause = employee.department
    ? translate('common.settings.serviceLetter.defaultBodyDepartmentClause', ' in the {{department}} department', { department: employee.department })
    : '';
  return translate('common.settings.serviceLetter.defaultBody', "This is to certify that {{name}} has been employed with {{company}} as {{roleOrTitle}}{{departmentClause}} since {{joinedDate}}. During this period, their conduct and performance have been found to be satisfactory.\n\nThis letter is issued upon the employee's request for whatever purpose it may serve.", {
    name: employee.fullName,
    company: companyName || translate('common.settings.serviceLetter.fallbackCompanyName', 'our company'),
    roleOrTitle: employee.jobTitle || roleLabel,
    departmentClause,
    joinedDate: joinedText,
  });
}

// The letter body is free text a user can print/share as a PDF via jsPDF's
// embedded NotoSans font (see serviceLetterPdf.ts) — NotoSans can't render
// CJK, so a zh/ja translation of this default template would otherwise
// corrupt the exported letter. Fall back to the English text in that case,
// same guard used for the Reports/Audit/Evaluation PDF exports.
const interpolate = (template: string, vars?: Record<string, unknown>): string =>
  vars ? template.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(vars[k] ?? '')) : template;

function defaultBody(employee: UserProfile, roleLabel: string, companyName: string, t: TFunction): string {
  // `vars` is never handed to i18next's own interpolation — only used to
  // resolve `defaultValue` — then substituted by hand on both outcomes.
  // i18next treats a `count` option as a plural-form selector, which
  // silently breaks defaultValue interpolation for a key without plural
  // suffixes (a real bug fixed twice already in the Reports PDF export).
  const translated = buildDefaultBody(employee, roleLabel, companyName, (key, defaultValue, vars) =>
    interpolate(t(key, { defaultValue }), vars),
  );
  const english = buildDefaultBody(employee, roleLabel, companyName, (_key, defaultValue, vars) =>
    interpolate(defaultValue, vars),
  );
  return pdfSafeText(translated, english);
}

export function ServiceLetterModal({ users, roleLabels, onClose }: ServiceLetterModalProps) {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const userProfile = useAuthStore((s) => s.userProfile);
  const toast = useToast();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [subject, setSubject] = useState('Service Letter');
  const [addressedTo, setAddressedTo] = useState('To Whom It May Concern');
  const [body, setBody] = useState('');
  const [remarks, setRemarks] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  useEffect(() => {
    if (!selectedUser) return;
    const roleLabel = roleLabels[selectedUser.role] ?? selectedUser.role;
    setBody(defaultBody(selectedUser, roleLabel, company?.name ?? '', t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  async function handleGenerate() {
    if (!selectedUser || !company || !userProfile) return;
    if (!subject.trim() || !body.trim()) {
      toast.error(t('common.settings.serviceLetter.errors.missingFields', 'Subject and letter body are required.'));
      return;
    }
    setGenerating(true);
    try {
      const { logoEmbedded } = await generateServiceLetter({
        company,
        employee: selectedUser,
        roleLabel: roleLabels[selectedUser.role] ?? selectedUser.role,
        form: { subject: subject.trim(), addressedTo: addressedTo.trim(), body: body.trim(), remarks: remarks.trim() },
        issuedBy: { id: userProfile.id, name: userProfile.fullName ?? '', role: roleLabels[userProfile.role] ?? userProfile.role },
        signatureImageDataUrl: signatureDataUrl,
      });
      if (company.logoUrl && !logoEmbedded) {
        toast.error(t('common.settings.serviceLetter.success.logoNotEmbedded', 'Service letter generated, but the company logo could not be embedded — try re-uploading it in Settings.'));
      } else {
        toast.success(t('common.settings.serviceLetter.success.generated', 'Service letter generated.'));
      }
      onClose();
    } catch (err) {
      console.error('Failed to generate service letter', err);
      toast.error(t('common.settings.serviceLetter.errors.generateFailed', 'Failed to generate service letter.'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{t('common.settings.serviceLetter.modalTitle', 'Generate Service Letter')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label={t('common.settings.serviceLetter.close', 'Close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.serviceLetter.selectUser', 'Select User')}</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">{t('common.settings.serviceLetter.selectUserPlaceholder', '— Select a user —')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} — {roleLabels[u.role] ?? u.role}
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div><span className="text-slate-400">{t('common.settings.serviceLetter.employeeId', 'Employee ID:')}</span> <span className="text-slate-800">{selectedUser.employeeId ?? '—'}</span></div>
                <div><span className="text-slate-400">{t('common.settings.serviceLetter.role', 'Role:')}</span> <span className="text-slate-800">{roleLabels[selectedUser.role] ?? selectedUser.role}</span></div>
                <div><span className="text-slate-400">{t('common.settings.serviceLetter.department', 'Department:')}</span> <span className="text-slate-800">{selectedUser.department ?? '—'}</span></div>
                <div><span className="text-slate-400">{t('common.settings.serviceLetter.designation', 'Designation:')}</span> <span className="text-slate-800">{selectedUser.jobTitle ?? '—'}</span></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.serviceLetter.subject', 'Subject')}</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.serviceLetter.addressedTo', 'Addressed To')}</label>
                <input value={addressedTo} onChange={(e) => setAddressedTo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.serviceLetter.letterBody', 'Letter Body')}</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.serviceLetter.remarks', 'Remarks (optional)')}</label>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">{t('common.settings.serviceLetter.signatureLabel', 'Digital Signature')}</label>
                <p className="text-xs text-slate-500 mb-2">
                  <Trans
                    t={t}
                    i18nKey="common.settings.serviceLetter.signatureHint"
                    components={{ color: <span className="font-semibold text-blue-900" /> }}
                  />
                </p>
                <SignaturePad onChange={setSignatureDataUrl} />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} disabled={generating} className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50">
            {t('common.settings.serviceLetter.cancel', 'Cancel')}
          </button>
          <button
            onClick={() => void handleGenerate()}
            disabled={!selectedUser || generating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? t('common.settings.serviceLetter.generating', 'Generating…') : t('common.settings.serviceLetter.generate', 'Generate Letter')}
          </button>
        </div>
      </div>
    </div>
  );
}
