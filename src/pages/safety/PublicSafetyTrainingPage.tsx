import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  HardHat,
  Loader2,
  Lock,
  Mic,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import {
  MAX_SAFETY_TRAINING_ATTEMPTS,
  SAFETY_TRAINING_MAX_ATTACHMENT_BYTES,
  SAFETY_TRAINING_MAX_AUDIO,
  SAFETY_TRAINING_MAX_IMAGES,
} from '@/lib/safety/contractorSafety';
import {
  pickRecordingType,
  prepareImage,
  prepareRecording,
  type PendingAttachment,
} from '@/lib/safety/attachmentUtils';
import {
  fetchSafetyTrainingForm,
  submitSafetyTrainingForm,
  type PublicAttemptSummary,
  type PublicLesson,
  type PublicQuizQuestion,
  type PublicSafetyTrainingForm,
  type PublicSubmissionResult,
} from '@/services/contractorSafetyTraining.service';

type ClosedReason = 'signed_off' | 'reassigned' | 'attempts_exhausted' | 'expired';

const MAX_RECORDING_SECONDS = 120;

function formatDue(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function errorCode(err: unknown): string {
  return (err as { code?: string } | null)?.code ?? '';
}

function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { message?: string } | null)?.message;
  // Callable errors read "functions/internal"-style when the server gave no text.
  return msg && !/^[a-z-]+\/?[a-z-]*$/i.test(msg) ? msg : fallback;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Public, no-login safety training form for contractor team members — opened
 * from the link they were sent. The token in the URL is the only credential;
 * everything goes through callables (see functions/src/safetyTraining). After
 * a submission the form closes, and the same link can be used to try again up
 * to the attempt limit, until the due date and time.
 */
export default function PublicSafetyTrainingPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();

  const [form, setForm] = useState<PublicSafetyTrainingForm | null>(null);
  // `retryable` is false for an invalid/replaced link — trying again can't fix that.
  const [loadError, setLoadError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'summary' | 'form' | 'done'>('form');
  const [result, setResult] = useState<PublicSubmissionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchSafetyTrainingForm(token);
      setForm(data);
      // Coming back to a link that already has a submission: show what was
      // sent first; another attempt is a deliberate click.
      setView(data.access.open && data.attempts.length > 0 ? 'summary' : 'form');
    } catch (err) {
      setLoadError(
        errorCode(err).endsWith('not-found')
          ? { message: t('common.safetyTrainings.publicForm.errors.invalidLink'), retryable: false }
          : { message: t('common.safetyTrainings.publicForm.errors.loadFailed'), retryable: true },
      );
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] px-4 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="FirmiCore" className="h-9 w-auto" />
            <span className="text-lg font-bold">
              <span className="text-white">Firmi</span>
              <span className="text-[#00C2FF]">Core</span>
            </span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="rounded-xl bg-white p-5 shadow-lg sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : loadError || !form ? (
            <Notice
              icon={<AlertCircle className="h-10 w-10 text-red-500" />}
              title={loadError?.message ?? t('common.safetyTrainings.publicForm.errors.loadFailed')}
              action={
                loadError?.retryable === false ? undefined : (
                  <button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                    <RotateCcw className="h-4 w-4" /> {t('common.safetyTrainings.publicForm.retry')}
                  </button>
                )
              }
            />
          ) : (
            <>
              <Header form={form} />
              {view === 'done' && result ? (
                <Done
                  form={form}
                  result={result}
                  onRetry={() => setView('form')}
                />
              ) : !form.access.open ? (
                <Closed reason={form.access.reason} attempts={form.attempts} />
              ) : view === 'summary' ? (
                <Summary
                  attempts={form.attempts}
                  remaining={form.access.attemptsRemaining}
                  onStart={() => setView('form')}
                />
              ) : (
                <TrainingForm
                  token={token}
                  form={form}
                  attemptsRemaining={form.access.attemptsRemaining}
                  onSubmitted={(r) => {
                    setResult(r);
                    setForm((cur) =>
                      cur
                        ? {
                            ...cur,
                            invite: { ...cur.invite, attemptsUsed: r.attemptNumber, status: 'submitted' },
                            access: r.canRetry
                              ? { open: true, attemptsRemaining: r.attemptsRemaining }
                              : {
                                  open: false,
                                  reason: r.attemptsRemaining > 0 ? 'expired' : 'attempts_exhausted',
                                },
                            // Only the final submission is kept (the server replaces
                            // the earlier one); attemptsUsed carries the count.
                            attempts: [
                              {
                                attemptNumber: r.attemptNumber,
                                submittedAtMs: Date.now(),
                                hasQuiz: r.hasQuiz,
                                score: r.score,
                                passed: r.passed,
                                attachmentCount: 0,
                              },
                            ],
                          }
                        : cur,
                    );
                    setView('done');
                    window.scrollTo({ top: 0 });
                  }}
                />
              )}
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">{t('common.safetyTrainings.publicForm.footer')}</p>
      </div>
    </div>
  );
}

function Notice({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-10 text-center">
      {icon}
      <p className="mt-1 text-lg font-semibold text-slate-900">{title}</p>
      {body && <p className="max-w-md text-sm text-slate-500">{body}</p>}
      {action}
    </div>
  );
}

function Header({ form }: { form: PublicSafetyTrainingForm }) {
  const { t } = useTranslation();
  const { invite } = form;
  return (
    <div className="mb-5 border-b border-slate-100 pb-4">
      <div className="flex items-center gap-2 text-amber-600">
        <ShieldCheck className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wide">{t('common.safetyTrainings.publicForm.badge')}</span>
      </div>
      <h1 className="mt-1 text-xl font-bold text-slate-900">{invite.moduleTitle}</h1>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <Row label={t('common.safetyTrainings.publicForm.details.name')} value={invite.technicianName} />
        <Row label={t('common.safetyTrainings.publicForm.details.contractor')} value={invite.contractorName} />
        <Row
          label={t('common.safetyTrainings.publicForm.details.site')}
          value={[invite.companyName, invite.plantName].filter(Boolean).join(' — ')}
        />
        <Row label={t('common.safetyTrainings.publicForm.details.due')} value={formatDue(invite.dueAtMs, invite.timezone)} />
        <Row
          label={t('common.safetyTrainings.publicForm.details.attempts')}
          value={t('common.safetyTrainings.publicForm.details.attemptsValue', {
            used: invite.attemptsUsed,
            max: invite.maxAttempts || MAX_SAFETY_TRAINING_ATTEMPTS,
          })}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function AttemptList({ attempts }: { attempts: PublicAttemptSummary[] }) {
  const { t } = useTranslation();
  if (attempts.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {attempts.map((a) => (
        <li key={a.attemptNumber} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-700">
            {t('common.safetyTrainings.publicForm.attemptN', { n: a.attemptNumber })}
            <span className="ml-2 text-xs text-slate-400">
              {a.submittedAtMs ? new Date(a.submittedAtMs).toLocaleString() : ''}
            </span>
          </span>
          {a.hasQuiz && a.score !== null ? (
            <span className={`font-semibold ${a.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
              {a.score}% · {a.passed ? t('common.safetyTrainings.publicForm.passed') : t('common.safetyTrainings.publicForm.belowPassMark')}
            </span>
          ) : (
            <span className="text-slate-500">{t('common.safetyTrainings.publicForm.submitted')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Closed({ reason, attempts }: { reason: ClosedReason; attempts: PublicAttemptSummary[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <Notice
        icon={reason === 'signed_off' ? <CheckCircle2 className="h-10 w-10 text-emerald-500" /> : <Lock className="h-10 w-10 text-slate-400" />}
        title={t(`common.safetyTrainings.publicForm.closed.${reason}.title`)}
        body={t(`common.safetyTrainings.publicForm.closed.${reason}.body`)}
      />
      <AttemptList attempts={attempts} />
    </div>
  );
}

function Summary({
  attempts,
  remaining,
  onStart,
}: {
  attempts: PublicAttemptSummary[];
  remaining: number;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t('common.safetyTrainings.publicForm.alreadySubmitted')}</p>
      <AttemptList attempts={attempts} />
      <p className="text-xs text-slate-500">{t('common.safetyTrainings.publicForm.replacesNote')}</p>
      <button
        type="button"
        onClick={onStart}
        className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
      >
        {t('common.safetyTrainings.publicForm.tryAgain', { count: remaining })}
      </button>
    </div>
  );
}

function Done({
  form,
  result,
  onRetry,
}: {
  form: PublicSafetyTrainingForm;
  result: PublicSubmissionResult;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Notice
        icon={<CheckCircle2 className="h-12 w-12 text-emerald-500" />}
        title={t('common.safetyTrainings.publicForm.done.title')}
        body={t('common.safetyTrainings.publicForm.done.body')}
      />
      {result.hasQuiz && result.score !== null && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
          <div className={`text-3xl font-bold ${result.passed ? 'text-emerald-600' : 'text-amber-600'}`}>{result.score}%</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {result.passed
              ? t('common.safetyTrainings.publicForm.done.passed', { mark: result.passingScore })
              : t('common.safetyTrainings.publicForm.done.belowPassMark', { mark: result.passingScore })}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <Clock className="h-4 w-4 shrink-0 text-slate-400" />
        {result.canRetry
          ? t('common.safetyTrainings.publicForm.done.canRetry', {
              count: result.attemptsRemaining,
              due: formatDue(form.invite.dueAtMs, form.invite.timezone),
            })
          : t('common.safetyTrainings.publicForm.done.noMoreAttempts')}
      </div>
      {result.canRetry && (
        <p className="text-xs text-slate-500">{t('common.safetyTrainings.publicForm.replacesNote')}</p>
      )}
      {result.canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-lg border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
        >
          {t('common.safetyTrainings.publicForm.done.submitAgain')}
        </button>
      )}
    </div>
  );
}

function LessonBlock({ lesson }: { lesson: PublicLesson }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const gallery = useMemo(() => {
    if (lesson.type !== 'image_gallery') return [];
    try {
      const parsed = JSON.parse(lesson.contentUrl) as { url: string; caption?: string }[];
      return Array.isArray(parsed) ? parsed.filter((g) => g && isHttpUrl(g.url)) : [];
    } catch {
      return [];
    }
  }, [lesson]);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-slate-800">{lesson.title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3">
          {lesson.description && <p className="whitespace-pre-wrap text-sm text-slate-600">{lesson.description}</p>}
          {lesson.type === 'text' && lesson.contentUrl && (
            <p className="whitespace-pre-wrap text-sm text-slate-800">{lesson.contentUrl}</p>
          )}
          {lesson.type === 'video' && isHttpUrl(lesson.contentUrl) && (
            <video
              controls
              playsInline
              preload="metadata"
              poster={isHttpUrl(lesson.thumbnailUrl) ? lesson.thumbnailUrl : undefined}
              src={lesson.contentUrl}
              className="w-full rounded-lg bg-black"
            />
          )}
          {lesson.type === 'document' && isHttpUrl(lesson.contentUrl) && (
            <a
              href={lesson.contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" /> {t('common.safetyTrainings.publicForm.openDocument')}
            </a>
          )}
          {lesson.type === 'image_gallery' &&
            gallery.map((g, i) => (
              <figure key={i}>
                <img src={g.url} alt={g.caption ?? ''} className="w-full rounded-lg" loading="lazy" />
                {g.caption && <figcaption className="mt-1 text-xs text-slate-500">{g.caption}</figcaption>}
              </figure>
            ))}
        </div>
      )}
    </div>
  );
}

function QuestionBlock({
  question,
  index,
  shuffleOptions,
  selected,
  onChange,
}: {
  question: PublicQuizQuestion;
  index: number;
  shuffleOptions: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const multiple = question.type === 'multiple_choice';
  const options = useMemo(() => (shuffleOptions ? shuffled(question.options) : question.options), [question.options, shuffleOptions]);

  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-900">
        {index + 1}. {question.text}
      </legend>
      {question.imageUrl && isHttpUrl(question.imageUrl) && (
        <img src={question.imageUrl} alt="" className="mb-2 max-h-48 rounded-lg" loading="lazy" />
      )}
      {multiple && <p className="mb-1 text-xs text-slate-400">{t('common.safetyTrainings.publicForm.selectAllThatApply')}</p>}
      <div className="space-y-1.5">
        {options.map((o) => {
          const checked = selected.includes(o.id);
          return (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                checked ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={`q-${question.id}`}
                checked={checked}
                onChange={() => {
                  if (multiple) onChange(checked ? selected.filter((id) => id !== o.id) : [...selected, o.id]);
                  else onChange([o.id]);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-slate-800">{o.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function VoiceRecorder({ disabled, onRecorded }: { disabled: boolean; onRecorded: (blob: Blob) => void }) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = pickRecordingType() !== null && !!navigator.mediaDevices?.getUserMedia;

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const type = pickRecordingType();
      const recorder = new MediaRecorder(stream, {
        ...(type ? { mimeType: type } : {}),
        audioBitsPerSecond: 32000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        if (chunks.length > 0) onRecorded(new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(t('common.safetyTrainings.publicForm.attachments.micDenied'));
    }
  }

  if (!supported) {
    return <p className="text-xs text-slate-400">{t('common.safetyTrainings.publicForm.attachments.voiceUnsupported')}</p>;
  }

  return (
    <div>
      {recording ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <Square className="h-4 w-4 fill-current" />
          {t('common.safetyTrainings.publicForm.attachments.stopRecording', {
            time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
          })}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Mic className="h-4 w-4" /> {t('common.safetyTrainings.publicForm.attachments.recordVoice')}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TrainingForm({
  token,
  form,
  attemptsRemaining,
  onSubmitted,
}: {
  token: string;
  form: PublicSafetyTrainingForm;
  attemptsRemaining: number;
  onSubmitted: (result: PublicSubmissionResult) => void;
}) {
  const { t } = useTranslation();
  const content = form.content;
  const quiz = content?.quiz ?? null;

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [declName, setDeclName] = useState(form.invite.technicianName);
  const [ack, setAck] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const questions = useMemo(
    () => (quiz ? (quiz.shuffleQuestions ? shuffled(quiz.questions) : quiz.questions) : []),
    [quiz],
  );

  // Free the preview object URLs when the form goes away.
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.previewUrl)), []);

  const images = attachments.filter((a) => a.kind === 'image');
  const audio = attachments.filter((a) => a.kind === 'audio');
  const totalBytes = attachments.reduce((sum, a) => sum + a.sizeBytes, 0);

  function addAttachment(a: PendingAttachment): boolean {
    if (totalBytes + a.sizeBytes > SAFETY_TRAINING_MAX_ATTACHMENT_BYTES) {
      URL.revokeObjectURL(a.previewUrl);
      setAttachError(t('common.safetyTrainings.publicForm.attachments.tooLarge'));
      return false;
    }
    setAttachError(null);
    setAttachments((prev) => [...prev, a]);
    return true;
  }

  async function onPickImages(files: FileList | null) {
    if (!files) return;
    setAttachError(null);
    let count = images.length;
    for (const file of Array.from(files)) {
      if (count >= SAFETY_TRAINING_MAX_IMAGES) {
        setAttachError(t('common.safetyTrainings.publicForm.attachments.maxImages', { max: SAFETY_TRAINING_MAX_IMAGES }));
        break;
      }
      try {
        if (addAttachment(await prepareImage(file, nanoid(8)))) count++;
      } catch {
        setAttachError(t('common.safetyTrainings.publicForm.attachments.imageFailed'));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onRecorded(blob: Blob) {
    if (audio.length >= SAFETY_TRAINING_MAX_AUDIO) {
      setAttachError(t('common.safetyTrainings.publicForm.attachments.maxAudio', { max: SAFETY_TRAINING_MAX_AUDIO }));
      return;
    }
    try {
      addAttachment(await prepareRecording(blob, nanoid(8)));
    } catch {
      setAttachError(t('common.safetyTrainings.publicForm.attachments.voiceFailed'));
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
    setAttachError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (quiz && quiz.questions.some((q) => !(answers[q.id]?.length > 0))) {
      setError(t('common.safetyTrainings.publicForm.errors.answerAll'));
      return;
    }
    if (declName.trim().length < 2) {
      setError(t('common.safetyTrainings.publicForm.errors.nameRequired'));
      return;
    }
    if (!ack) {
      setError(t('common.safetyTrainings.publicForm.errors.ackRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitSafetyTrainingForm({
        token,
        answers,
        notes: notes.trim(),
        declarationName: declName.trim(),
        acknowledged: true,
        attachments: attachments.map(({ name, mimeType, data }) => ({ name, mimeType, data })),
      });
      onSubmitted(result);
    } catch (err) {
      const code = errorCode(err);
      setError(
        code.endsWith('failed-precondition')
          ? errorMessage(err, t('common.safetyTrainings.publicForm.errors.closed'))
          : code.endsWith('invalid-argument')
            ? errorMessage(err, t('common.safetyTrainings.publicForm.errors.submitFailed'))
            : t('common.safetyTrainings.publicForm.errors.submitFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
        <HardHat className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('common.safetyTrainings.publicForm.intro', { count: attemptsRemaining })}</span>
      </div>

      {content && (content.description || content.lessons.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">{t('common.safetyTrainings.publicForm.sections.training')}</h2>
          {content.description && <p className="whitespace-pre-wrap text-sm text-slate-600">{content.description}</p>}
          {content.lessons.map((l) => (
            <LessonBlock key={l.id || l.title} lesson={l} />
          ))}
        </section>
      )}

      {quiz && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {quiz.title || t('common.safetyTrainings.publicForm.sections.quiz')}
          </h2>
          {quiz.instructions && <p className="whitespace-pre-wrap text-sm text-slate-600">{quiz.instructions}</p>}
          <p className="text-xs text-slate-400">
            {t('common.safetyTrainings.publicForm.passMark', { mark: form.invite.passingScore })}
          </p>
          {questions.map((q, i) => (
            <QuestionBlock
              key={q.id}
              question={q}
              index={i}
              shuffleOptions={quiz.shuffleOptions}
              selected={answers[q.id] ?? []}
              onChange={(ids) => setAnswers((prev) => ({ ...prev, [q.id]: ids }))}
            />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">
          {t('common.safetyTrainings.publicForm.sections.comments')}{' '}
          <span className="font-normal text-slate-400">{t('common.safetyTrainings.publicForm.optional')}</span>
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t('common.safetyTrainings.publicForm.commentsPlaceholder')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t('common.safetyTrainings.publicForm.sections.attachments')}{' '}
            <span className="font-normal text-slate-400">{t('common.safetyTrainings.publicForm.optional')}</span>
          </h2>
          <p className="text-xs text-slate-400">{t('common.safetyTrainings.publicForm.attachments.hint')}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onPickImages(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= SAFETY_TRAINING_MAX_IMAGES}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" /> {t('common.safetyTrainings.publicForm.attachments.addPhotos')}
          </button>
          <VoiceRecorder disabled={audio.length >= SAFETY_TRAINING_MAX_AUDIO} onRecorded={(b) => void onRecorded(b)} />
        </div>
        {attachError && <p className="text-xs text-red-600">{attachError}</p>}
        {attachments.length > 0 && (
          <ul className="space-y-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                {a.kind === 'image' ? (
                  <img src={a.previewUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                ) : (
                  <audio controls src={a.previewUrl} className="h-10 min-w-0 flex-1" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                  {a.kind === 'image' ? a.name : ''} {Math.max(1, Math.round(a.sizeBytes / 1024))} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={t('common.safetyTrainings.publicForm.attachments.remove')}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-3">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span>{t('common.safetyTrainings.publicForm.declaration')}</span>
        </label>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('common.safetyTrainings.publicForm.signatureLabel')}
          </label>
          <input
            value={declName}
            onChange={(e) => setDeclName(e.target.value)}
            maxLength={120}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? t('common.safetyTrainings.publicForm.submitting') : t('common.safetyTrainings.publicForm.submit')}
      </button>
    </form>
  );
}
