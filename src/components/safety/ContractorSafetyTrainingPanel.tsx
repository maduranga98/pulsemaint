import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileCheck2,
  HardHat,
  Loader2,
  Mail,
  MailX,
  Mic,
  RefreshCw,
  Search,
  ShieldOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useContractors } from '@/hooks/contractors/useContractors';
import { usePlants } from '@/hooks/usePlants';
import { combineDueDateTime, formatDueDateTime } from '@/lib/training/dueDateTime';
import { resolveAppBaseUrl } from '@/lib/machineQr';
import { downloadSafetyCardPdf } from '@/lib/safety/safetyCardPdf';
import {
  SAFETY_CARD_DEFAULT_VALID_MONTHS,
  addMonths,
  buildSafetyTrainingLink,
  getInviteAccess,
  getInviteDisplayStatus,
  inviteDueMillis,
  isSafetyCardValid,
  type ContractorSafetyCard,
  type ContractorSafetyTrainingInvite,
  type InviteDisplayStatus,
  type SafetyTrainingAttempt,
} from '@/lib/safety/contractorSafety';
import {
  describeField,
  getContractorTechnician,
  getSafetyCard,
  issueSafetyCard,
  reassignInvite,
  revokeSafetyCard,
  sendInviteEmails,
  signOffInvite,
  TECHNICIAN_DESIGNATION_LABELS,
} from '@/services/contractorSafetyTraining.service';
import type { Contractor, ContractorTechnician } from '@/lib/contractors/contractorTypes';

type Filter = 'all' | InviteDisplayStatus;
const FILTERS: Filter[] = ['all', 'submitted', 'awaiting', 'overdue', 'signed_off', 'reassigned'];

const STATUS_CLASS: Record<InviteDisplayStatus, string> = {
  awaiting: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
  signed_off: 'bg-emerald-100 text-emerald-700',
  reassigned: 'bg-slate-100 text-slate-400',
};

function fmtTs(ts: { toDate?: () => Date } | null | undefined): string {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

interface Props {
  invites: ContractorSafetyTrainingInvite[];
  cards: ContractorSafetyCard[];
  loading: boolean;
}

/**
 * The safety officer's view of contractor team members' safety trainings:
 * what each one submitted (marks, notes, photos, voice notes) and the
 * actions on it — reassign, sign off, issue the Contractor Safety Card.
 */
export default function ContractorSafetyTrainingPanel({ invites, cards, loading }: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [reassigning, setReassigning] = useState<ContractorSafetyTrainingInvite | null>(null);
  const [signingOff, setSigningOff] = useState<ContractorSafetyTrainingInvite | null>(null);
  const [issuing, setIssuing] = useState<ContractorSafetyTrainingInvite | null>(null);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();
    return invites
      .map((inv) => ({ inv, status: getInviteDisplayStatus({ ...inv, dueAtMs: inviteDueMillis(inv) }, now) }))
      .filter(({ status }) => filter === 'all' || status === filter)
      .filter(
        ({ inv }) =>
          !term ||
          [inv.technicianName, inv.contractorName, inv.moduleTitle, inv.technicianNic].some((v) =>
            (v ?? '').toLowerCase().includes(term),
          ),
      );
  }, [invites, filter, search]);

  const counts = useMemo(() => {
    const now = Date.now();
    const c: Record<string, number> = { all: invites.length };
    for (const inv of invites) {
      const s = getInviteDisplayStatus({ ...inv, dueAtMs: inviteDueMillis(inv) }, now);
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [invites]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-amber-600" size={26} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat value={counts.submitted ?? 0} label={t('common.safetyTrainings.contractor.stats.awaitingReview')} />
        <Stat value={counts.signed_off ?? 0} label={t('common.safetyTrainings.contractor.stats.signedOff')} />
        <Stat value={cards.filter((c) => isSafetyCardValid(c)).length} label={t('common.safetyTrainings.contractor.stats.cardsActive')} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? 'border-amber-600 bg-amber-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t(`common.safetyTrainings.contractor.filters.${f}`)}
            <span className="ml-1 opacity-70">{counts[f] ?? 0}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.safetyTrainings.contractor.searchPlaceholder')}
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {invites.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {t('common.safetyTrainings.contractor.empty')}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {t('common.safetyTrainings.contractor.emptyFiltered')}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ inv, status }) => (
            <InviteRow
              key={inv.id}
              inv={inv}
              status={status}
              card={inv.cardId ? cardsById.get(inv.cardId) ?? null : null}
              onReassign={() => setReassigning(inv)}
              onSignOff={() => setSigningOff(inv)}
              onIssue={() => setIssuing(inv)}
            />
          ))}
        </div>
      )}

      {reassigning && <ReassignDialog invite={reassigning} onClose={() => setReassigning(null)} />}
      {signingOff && <SignOffDialog invite={signingOff} onClose={() => setSigningOff(null)} />}
      {issuing && <IssueCardDialog invite={issuing} onClose={() => setIssuing(null)} />}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function InviteRow({
  inv,
  status,
  card,
  onReassign,
  onSignOff,
  onIssue,
}: {
  inv: ContractorSafetyTrainingInvite;
  status: InviteDisplayStatus;
  card: ContractorSafetyCard | null;
  onReassign: () => void;
  onSignOff: () => void;
  onIssue: () => void;
}) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const dueAtMs = inviteDueMillis(inv);
  const access = getInviteAccess({ ...inv, dueAtMs });
  const attempts = inv.attempts ?? [];
  const hasSubmission = attempts.length > 0;
  const belowPass = inv.hasQuiz && (inv.bestScore ?? 0) < inv.passingScore;
  const cardActive = card ? isSafetyCardValid(card) : false;

  async function copyLink() {
    const link = buildSafetyTrainingLink(resolveAppBaseUrl(), inv.id);
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('common.safetyTrainings.contractor.toasts.linkCopied'));
    } catch {
      window.prompt(t('common.safetyTrainings.contractor.toasts.copyPrompt'), link);
    }
  }

  async function resend() {
    setBusy('resend');
    const [res] = await sendInviteEmails([inv.id]);
    setBusy(null);
    if (res?.status === 'sent') toast.success(t('common.safetyTrainings.contractor.toasts.linkResent'));
    else if (res?.status === 'no_email') toast.error(t('common.safetyTrainings.contractor.toasts.noEmail'));
    else toast.error(t('common.safetyTrainings.contractor.toasts.resendFailed'));
  }

  async function download() {
    if (!card) return;
    setBusy('download');
    try {
      await downloadSafetyCardPdf(card);
    } catch (err) {
      console.error('Failed to build safety card PDF', err);
      toast.error(t('common.safetyTrainings.contractor.toasts.pdfFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!card || !profile) return;
    const reason = window.prompt(t('common.safetyTrainings.contractor.revokePrompt'));
    if (reason === null) return;
    setBusy('revoke');
    try {
      await revokeSafetyCard(card.id, reason, { id: profile.id, name: profile.fullName ?? '' });
      toast.success(t('common.safetyTrainings.contractor.toasts.cardRevoked'));
    } catch (err) {
      console.error('Failed to revoke safety card', err);
      toast.error(t('common.safetyTrainings.contractor.toasts.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  const btn =
    'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50';

  return (
    <div className={`rounded-xl border bg-white p-4 ${status === 'reassigned' ? 'border-slate-100 opacity-70' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{inv.technicianName}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}>
              {t(`common.safetyTrainings.contractor.status.${status}`)}
            </span>
            {card && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  cardActive ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
                }`}
              >
                <BadgeCheck className="h-3 w-3" />
                {cardActive
                  ? t('common.safetyTrainings.contractor.cardBadge', { number: card.cardNumber })
                  : t('common.safetyTrainings.contractor.cardInactive', { number: card.cardNumber })}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <HardHat className="h-3.5 w-3.5" /> {inv.contractorName}
            </span>
            <span>{inv.moduleTitle}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {t('common.safetyTrainings.contractor.row.due', { date: formatDueDateTime(inv.dueAt) })}
            </span>
            <span className="inline-flex items-center gap-1">
              {inv.emailStatus === 'sent' ? <Mail className="h-3.5 w-3.5 text-emerald-500" /> : <MailX className="h-3.5 w-3.5 text-amber-500" />}
              {t(`common.safetyTrainings.contractor.row.email.${inv.emailStatus}`)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 text-right">
          <div>
            <div className="text-[11px] uppercase text-slate-400">{t('common.safetyTrainings.contractor.row.marks')}</div>
            {inv.hasQuiz ? (
              inv.bestScore !== null && inv.bestScore !== undefined ? (
                <div className={`text-lg font-bold leading-tight ${belowPass ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {inv.bestScore}%
                </div>
              ) : (
                <div className="text-lg font-bold leading-tight text-slate-300">—</div>
              )
            ) : (
              <div className="text-xs text-slate-500">{t('common.safetyTrainings.contractor.row.noQuiz')}</div>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase text-slate-400">{t('common.safetyTrainings.contractor.row.attempts')}</div>
            <div className="text-lg font-bold leading-tight text-slate-700">
              {inv.attemptsUsed ?? 0}/{inv.maxAttempts}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status !== 'reassigned' && status !== 'signed_off' && (
          <button type="button" onClick={onReassign} className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            <RefreshCw className="h-3.5 w-3.5" /> {t('common.safetyTrainings.contractor.actions.reassign')}
          </button>
        )}
        {status === 'submitted' && (
          <button type="button" onClick={onSignOff} className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {t('common.safetyTrainings.contractor.actions.signOff')}
          </button>
        )}
        {status === 'signed_off' && !card && (
          <button type="button" onClick={onIssue} className={`${btn} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}>
            <FileCheck2 className="h-3.5 w-3.5" /> {t('common.safetyTrainings.contractor.actions.issueCard')}
          </button>
        )}
        {card && cardActive && (
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy === 'download'}
            className={`${btn} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}
          >
            {busy === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {t('common.safetyTrainings.contractor.actions.downloadCard')}
          </button>
        )}
        {card && cardActive && (
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={busy === 'revoke'}
            className={`${btn} border-red-200 bg-white text-red-600 hover:bg-red-50`}
          >
            <ShieldOff className="h-3.5 w-3.5" /> {t('common.safetyTrainings.contractor.actions.revokeCard')}
          </button>
        )}
        {access.open && (
          <>
            <button type="button" onClick={() => void copyLink()} className={`${btn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
              <Copy className="h-3.5 w-3.5" /> {t('common.safetyTrainings.contractor.actions.copyLink')}
            </button>
            {inv.technicianEmail && (
              <button
                type="button"
                onClick={() => void resend()}
                disabled={busy === 'resend'}
                className={`${btn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
              >
                {busy === 'resend' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                {t('common.safetyTrainings.contractor.actions.resendEmail')}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-amber-700"
        >
          {t('common.safetyTrainings.contractor.actions.details')}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <Detail label={t('common.safetyTrainings.contractor.details.nic')} value={inv.technicianNic} />
            <Detail label={t('common.safetyTrainings.contractor.details.assignedBy')} value={inv.assignedByName} />
            <Detail label={t('common.safetyTrainings.contractor.details.assignedAt')} value={fmtTs(inv.assignedAt)} />
          </dl>

          {!hasSubmission ? (
            <p className="text-sm text-slate-500">{t('common.safetyTrainings.contractor.details.noAttempts')}</p>
          ) : (
            attempts.map((a) => <AttemptCard key={a.attemptNumber} attempt={a} passingScore={inv.passingScore} />)
          )}

          {inv.signOff && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {t('common.safetyTrainings.contractor.details.signedOffBy', {
                name: inv.signOff.byName,
                date: fmtTs(inv.signOff.at),
              })}
              {inv.signOff.note ? ` — ${inv.signOff.note}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value || '—'}</dd>
    </div>
  );
}

function AttemptCard({ attempt, passingScore }: { attempt: SafetyTrainingAttempt; passingScore: number }) {
  const { t } = useTranslation();
  const images = attempt.attachments?.filter((a) => a.kind === 'image') ?? [];
  const audio = attempt.attachments?.filter((a) => a.kind === 'audio') ?? [];
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">
          {t('common.safetyTrainings.contractor.details.attemptN', { n: attempt.attemptNumber })}
          <span className="ml-2 text-xs font-normal text-slate-400">{fmtTs(attempt.submittedAt)}</span>
        </span>
        {attempt.hasQuiz ? (
          <span className={`text-sm font-semibold ${attempt.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
            {attempt.score}% ({attempt.correctAnswers}/{attempt.totalQuestions}) ·{' '}
            {attempt.passed
              ? t('common.safetyTrainings.contractor.details.passed', { mark: passingScore })
              : t('common.safetyTrainings.contractor.details.belowPassMark', { mark: passingScore })}
          </span>
        ) : (
          <span className="text-xs text-slate-500">{t('common.safetyTrainings.contractor.row.noQuiz')}</span>
        )}
      </div>
      {attempt.declarationName && (
        <p className="mt-1 text-xs text-slate-500">
          {t('common.safetyTrainings.contractor.details.signedAs', { name: attempt.declarationName })}
        </p>
      )}
      {attempt.notes && (
        <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 px-2.5 py-2 text-sm text-slate-700">{attempt.notes}</p>
      )}
      {images.length > 0 || audio.length > 0 ? (
        <div className="mt-2 space-y-2">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <a key={img.path} href={img.url} target="_blank" rel="noopener noreferrer" title={img.name}>
                  <img src={img.url} alt={img.name} className="h-16 w-16 rounded-md border border-slate-200 object-cover hover:opacity-80" loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {audio.map((a) => (
            <div key={a.path} className="flex items-center gap-2">
              <Mic className="h-4 w-4 shrink-0 text-slate-400" />
              <audio controls src={a.url} className="h-9 w-full max-w-sm" preload="none" />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">{t('common.safetyTrainings.contractor.details.noAttachments')}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label={t('common.trainingShared.assignForm.closeAria')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">{children}</div>
      </div>
    </div>
  );
}

function ReassignDialog({ invite, onClose }: { invite: ContractorSafetyTrainingInvite; onClose: () => void }) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const dueAt = combineDueDateTime(dueDate, dueTime);
    if (!dueAt) return setError(t('common.safetyTrainings.assign.errors.dueRequired'));
    if (dueAt.getTime() <= Date.now()) return setError(t('common.safetyTrainings.assign.errors.dueInPast'));
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const tech = await getContractorTechnician(invite.contractorId, invite.technicianId);
      const { email } = await reassignInvite(invite, dueAt, { id: profile.id, name: profile.fullName ?? '' }, tech);
      toast.success(
        email?.status === 'sent'
          ? t('common.safetyTrainings.contractor.toasts.reassignedEmailed')
          : t('common.safetyTrainings.contractor.toasts.reassignedNoEmail'),
      );
      onClose();
    } catch (err) {
      console.error('Failed to reassign safety training', err);
      setError(t('common.safetyTrainings.contractor.toasts.actionFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('common.safetyTrainings.contractor.reassignDialog.title')}
      subtitle={`${invite.technicianName} · ${invite.moduleTitle}`}
      onClose={onClose}
    >
      <p className="text-sm text-slate-600">{t('common.safetyTrainings.contractor.reassignDialog.body')}</p>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {t('common.safetyTrainings.assign.dueRequiredLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label={t('common.trainingShared.assignForm.dueDate')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            disabled={!dueDate}
            aria-label={t('common.trainingShared.assignForm.dueTime')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <DialogButtons
        onCancel={onClose}
        onConfirm={() => void submit()}
        saving={saving}
        confirmLabel={t('common.safetyTrainings.contractor.reassignDialog.confirm')}
      />
    </Modal>
  );
}

function SignOffDialog({ invite, onClose }: { invite: ContractorSafetyTrainingInvite; onClose: () => void }) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const belowPass = invite.hasQuiz && (invite.bestScore ?? 0) < invite.passingScore;

  async function submit() {
    if (!profile) return;
    setSaving(true);
    try {
      await signOffInvite(invite.id, note, { id: profile.id, name: profile.fullName ?? '' });
      toast.success(t('common.safetyTrainings.contractor.toasts.signedOff'));
      onClose();
    } catch (err) {
      console.error('Failed to sign off safety training', err);
      toast.error(t('common.safetyTrainings.contractor.toasts.actionFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('common.safetyTrainings.contractor.signOffDialog.title')}
      subtitle={`${invite.technicianName} · ${invite.moduleTitle}`}
      onClose={onClose}
    >
      <p className="text-sm text-slate-600">
        {invite.hasQuiz
          ? t('common.safetyTrainings.contractor.signOffDialog.bodyScore', { score: invite.bestScore ?? 0, mark: invite.passingScore })
          : t('common.safetyTrainings.contractor.signOffDialog.bodyNoQuiz')}
      </p>
      {belowPass && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t('common.safetyTrainings.contractor.signOffDialog.warnBelowPass')}
        </p>
      )}
      <p className="text-xs text-slate-500">{t('common.safetyTrainings.contractor.signOffDialog.closesLink')}</p>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {t('common.safetyTrainings.contractor.signOffDialog.noteLabel')}{' '}
          <span className="font-normal text-slate-400">{t('common.trainingShared.assignForm.optional')}</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <DialogButtons
        onCancel={onClose}
        onConfirm={() => void submit()}
        saving={saving}
        confirmLabel={t('common.safetyTrainings.contractor.signOffDialog.confirm')}
      />
    </Modal>
  );
}

function IssueCardDialog({ invite, onClose }: { invite: ContractorSafetyTrainingInvite; onClose: () => void }) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const { contractors } = useContractors();
  const { plants } = usePlants(profile?.companyId ?? '');
  const [tech, setTech] = useState<ContractorTechnician | null | undefined>(undefined);
  const [validUntil, setValidUntil] = useState(() => {
    const d = addMonths(new Date(), SAFETY_CARD_DEFAULT_VALID_MONTHS);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<ContractorSafetyCard | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractor: Contractor | null = contractors.find((c) => c.id === invite.contractorId) ?? null;
  const plantName = plants.find((p) => p.id === invite.plantId)?.name ?? '';

  // Current record of the team member (photo, NIC, field) — loaded once.
  useEffect(() => {
    let cancelled = false;
    void getContractorTechnician(invite.contractorId, invite.technicianId).then((rec) => {
      if (!cancelled) setTech(rec);
    });
    return () => {
      cancelled = true;
    };
  }, [invite.contractorId, invite.technicianId]);

  const preview = {
    name: tech?.fullName ?? invite.technicianName,
    nic: tech?.nicOrPassport ?? invite.technicianNic,
    position:
      TECHNICIAN_DESIGNATION_LABELS[tech?.designation ?? invite.technicianDesignation] ??
      (tech?.designation ?? invite.technicianDesignation),
    field: describeField(tech, contractor),
    contact: contractor
      ? [contractor.primaryContactName, contractor.primaryContactDesig, contractor.primaryPhone].filter(Boolean).join(' · ')
      : '',
  };

  async function submit() {
    if (!profile || !contractor) return;
    const [y, m, d] = validUntil.split('-').map(Number);
    const until = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59);
    if (!y || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      setError(t('common.safetyTrainings.contractor.issueDialog.errors.validUntil'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const cardId = await issueSafetyCard({
        invite,
        contractor,
        technician: tech ?? null,
        companyName: company?.tradeName || company?.name || '',
        plantName,
        validUntil: until,
        issuer: { id: profile.id, name: profile.fullName ?? '' },
      });
      setIssued(await getSafetyCard(cardId));
      toast.success(t('common.safetyTrainings.contractor.toasts.cardIssued'));
    } catch (err) {
      console.error('Failed to issue safety card', err);
      setError(t('common.safetyTrainings.contractor.toasts.actionFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    if (!issued) return;
    setDownloading(true);
    try {
      await downloadSafetyCardPdf(issued);
    } catch (err) {
      console.error('Failed to build safety card PDF', err);
      toast.error(t('common.safetyTrainings.contractor.toasts.pdfFailed'));
    } finally {
      setDownloading(false);
    }
  }

  if (issued) {
    return (
      <Modal title={t('common.safetyTrainings.contractor.issueDialog.issuedTitle')} subtitle={issued.cardNumber} onClose={onClose}>
        <p className="text-sm text-slate-600">{t('common.safetyTrainings.contractor.issueDialog.issuedBody')}</p>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('common.safetyTrainings.contractor.issueDialog.downloadPdf')}
        </button>
        <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          {t('common.trainingShared.assignForm.result.done')}
        </button>
      </Modal>
    );
  }

  return (
    <Modal
      title={t('common.safetyTrainings.contractor.issueDialog.title')}
      subtitle={`${invite.technicianName} · ${invite.contractorName}`}
      onClose={onClose}
    >
      <p className="text-sm text-slate-600">{t('common.safetyTrainings.contractor.issueDialog.body')}</p>
      {!contractor ? (
        <p className="text-sm text-red-500">{t('common.safetyTrainings.contractor.issueDialog.errors.noContractor')}</p>
      ) : (
        <dl className="space-y-1.5 rounded-lg bg-slate-50 px-3 py-3 text-sm">
          <Detail label={t('common.safetyTrainings.contractor.issueDialog.fields.name')} value={preview.name} />
          <Detail label={t('common.safetyTrainings.contractor.issueDialog.fields.nic')} value={preview.nic} />
          <Detail label={t('common.safetyTrainings.contractor.issueDialog.fields.position')} value={preview.position} />
          <Detail label={t('common.safetyTrainings.contractor.issueDialog.fields.field')} value={preview.field} />
          <Detail label={t('common.safetyTrainings.contractor.issueDialog.fields.contractor')} value={contractor.companyName} />
          <Detail label={t('common.safetyTrainings.contractor.issueDialog.fields.contact')} value={preview.contact} />
        </dl>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {t('common.safetyTrainings.contractor.issueDialog.validUntil')}
        </label>
        <input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <DialogButtons
        onCancel={onClose}
        onConfirm={() => void submit()}
        saving={saving}
        disabled={!contractor || tech === undefined}
        confirmLabel={t('common.safetyTrainings.contractor.issueDialog.confirm')}
      />
    </Modal>
  );
}

function DialogButtons({
  onCancel,
  onConfirm,
  saving,
  disabled,
  confirmLabel,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  disabled?: boolean;
  confirmLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-3 pt-1">
      <button onClick={onCancel} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
        {t('common.trainingShared.assignForm.cancel')}
      </button>
      <button
        onClick={onConfirm}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}
