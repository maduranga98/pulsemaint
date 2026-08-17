import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Paperclip, X, CheckCircle2, Globe2 } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import type { TrainingAssignment, TrainingModule } from '@/lib/training/trainingTypes';
import { OFFBOARD_MODE_LABELS } from '@/lib/training/offboardTraining';

interface OffboardTrainingCompletionFormProps {
  assignment: TrainingAssignment;
  module: TrainingModule;
  onBack: () => void;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = (value as { toDate?: () => Date }).toDate
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export default function OffboardTrainingCompletionForm({
  assignment,
  module,
  onBack,
}: OffboardTrainingCompletionFormProps) {
  const { t } = useTranslation();
  const details = module.offboardDetails ?? assignment.offboardDetails ?? null;
  const existing = assignment.offboardCompletion ?? null;
  const alreadySubmitted = !!existing?.reportSubmittedAt;

  const questions = details?.assessmentQuestions ?? [];

  const [knowledgeGained, setKnowledgeGained] = useState(existing?.knowledgeGained ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const q of questions) map[q] = '';
    for (const a of existing?.assessmentAnswers ?? []) map[a.question] = a.answer;
    return map;
  });
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(existing?.attachmentUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadySubmitted);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(`${file.name} exceeds the 25MB limit.`);
        }
        const path = `companies/${assignment.companyId}/training/offboard-reports/${assignment.id}/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        urls.push(url);
      }
      setAttachmentUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.training.offboardTrainingCompletionForm.uploadErrorDefault'));
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(url: string) {
    setAttachmentUrls((prev) => prev.filter((u) => u !== url));
  }

  const canSubmit = knowledgeGained.trim().length > 0 && !submitting && !uploading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const assessmentAnswers = questions.map((q) => ({
        question: q,
        answer: answers[q] ?? '',
      }));

      await updateDoc(doc(db, 'trainingAssignments', assignment.id), {
        offboardCompletion: {
          knowledgeGained: knowledgeGained.trim(),
          assessmentAnswers,
          attachmentUrls,
          actualStartDate: existing?.actualStartDate ?? null,
          actualEndDate: existing?.actualEndDate ?? null,
          // Plain field write (not inside arrayUnion) — serverTimestamp() is safe here.
          reportSubmittedAt: serverTimestamp(),
          reportGeneratedPdfUrl: existing?.reportGeneratedPdfUrl ?? '',
        },
        status: 'awaiting_practical',
        lastActivityAt: serverTimestamp(),
        completedAt: existing?.reportSubmittedAt ? undefined : Timestamp.now(),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.training.offboardTrainingCompletionForm.submitErrorDefault'));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-16 gap-4 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{t('common.training.offboardTrainingCompletionForm.doneTitle')}</h2>
        <p className="text-gray-600 text-sm">
          {t('common.training.offboardTrainingCompletionForm.doneDescription')}
        </p>
        <button
          onClick={onBack}
          className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {t('common.training.offboardTrainingCompletionForm.backToTraining')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
        ← {t('common.training.offboardTrainingCompletionForm.backToTraining')}
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-purple-500" />
          <h1 className="text-lg font-semibold text-gray-900">{module.title}</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">{t('common.training.offboardTrainingCompletionForm.providerLabel')}</span><p className="text-gray-800">{details?.thirdPartyCompany || '—'}</p></div>
          <div><span className="text-gray-400">{t('common.training.offboardTrainingCompletionForm.countryLabel')}</span><p className="text-gray-800">{details?.country || '—'}</p></div>
          <div><span className="text-gray-400">{t('common.training.offboardTrainingCompletionForm.modeLabel')}</span><p className="text-gray-800">{details?.mode ? OFFBOARD_MODE_LABELS[details.mode] : '—'}</p></div>
          <div><span className="text-gray-400">{t('common.training.offboardTrainingCompletionForm.durationLabel')}</span><p className="text-gray-800">{t('common.training.offboardTrainingCompletionForm.day', { count: details?.durationDays ?? 0 })}</p></div>
          <div><span className="text-gray-400">{t('common.training.offboardTrainingCompletionForm.startLabel')}</span><p className="text-gray-800">{formatDate(details?.startDate)}</p></div>
          <div><span className="text-gray-400">{t('common.training.offboardTrainingCompletionForm.endLabel')}</span><p className="text-gray-800">{formatDate(details?.endDate)}</p></div>
        </div>
        {details?.topic && (
          <div className="text-sm"><span className="text-gray-400">{t('common.training.offboardTrainingCompletionForm.topicLabel')}</span><p className="text-gray-800">{details.topic}</p></div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
        <label className="text-sm font-semibold text-gray-800">
          {t('common.training.offboardTrainingCompletionForm.knowledgeGainedLabel')} <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={5}
          value={knowledgeGained}
          onChange={(e) => setKnowledgeGained(e.target.value)}
          placeholder={t('common.training.offboardTrainingCompletionForm.knowledgeGainedPlaceholder')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {questions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">{t('common.training.offboardTrainingCompletionForm.assessmentQuestionsTitle')}</h2>
          {questions.map((q) => (
            <div key={q} className="flex flex-col gap-1">
              <label className="text-sm text-gray-700">{q}</label>
              <textarea
                rows={2}
                value={answers[q] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">{t('common.training.offboardTrainingCompletionForm.attachmentsTitle')}</h2>
        <label className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer w-fit">
          <Paperclip className="w-4 h-4" />
          {t('common.training.offboardTrainingCompletionForm.uploadLabel')}
          <input type="file" multiple className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
        {uploading && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> {t('common.training.offboardTrainingCompletionForm.uploading')}
          </p>
        )}
        {attachmentUrls.length > 0 && (
          <ul className="space-y-1">
            {attachmentUrls.map((url) => (
              <li key={url} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                  {url.split('/').pop()?.split('?')[0]}
                </a>
                <button onClick={() => removeAttachment(url)} className="text-gray-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {t('common.training.offboardTrainingCompletionForm.submitButton')}
      </button>
    </div>
  );
}
