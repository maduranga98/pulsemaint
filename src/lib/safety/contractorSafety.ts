import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Contractor safety training — link-based training for contractor team
// members (who have no FirmiCore login) and the Contractor Safety Card issued
// once a safety officer signs the submission off.
//
// Company users (technicians, supervisors, ...) keep the in-app safety
// training flow (`trainingAssignments`); nothing here applies to them.
// ---------------------------------------------------------------------------

/** A team member gets this many submissions per assignment, until the due date/time. */
export const MAX_SAFETY_TRAINING_ATTEMPTS = 3;

/** Default validity of an issued Contractor Safety Card, in months. */
export const SAFETY_CARD_DEFAULT_VALID_MONTHS = 12;

/** Contractor Safety Card print size — 3.5 × 2 inches. */
export const SAFETY_CARD_WIDTH_IN = 3.5;
export const SAFETY_CARD_HEIGHT_IN = 2;

/** Upload limits for the optional attachments on the public form. */
export const SAFETY_TRAINING_MAX_IMAGES = 5;
export const SAFETY_TRAINING_MAX_AUDIO = 2;
/** Longest qualification title an officer can add at sign-off (e.g. "NVQ Level 4 — Welding"). */
export const SAFETY_TRAINING_MAX_QUALIFICATION_LENGTH = 120;
/** Raw size cap across all attachments of one submission (the callable payload is limited to 10 MB). */
export const SAFETY_TRAINING_MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;

export type ContractorTrainingStatus = 'assigned' | 'submitted' | 'signed_off' | 'reassigned';
export type InviteEmailStatus = 'pending' | 'sent' | 'failed' | 'no_email';

export interface SafetyTrainingAttachment {
  name: string;
  url: string;
  /** Storage path, so the file can be cleaned up later. */
  path: string;
  kind: 'image' | 'audio';
  mimeType: string;
  sizeBytes: number;
}

export interface SafetyTrainingAttemptAnswer {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  pointsEarned: number;
}

export interface SafetyTrainingAttempt {
  attemptNumber: number;
  submittedAt: Timestamp | null;
  /** The module has a quiz — otherwise the form is an acknowledgement only. */
  hasQuiz: boolean;
  /** Percentage 0–100; null when there is no quiz. */
  score: number | null;
  earnedPoints: number;
  totalPoints: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  answers: SafetyTrainingAttemptAnswer[];
  notes: string;
  /** Name typed as the signature on the declaration. */
  declarationName: string;
  attachments: SafetyTrainingAttachment[];
}

export interface ContractorSafetyTrainingInvite {
  /** Doc id — also the unguessable token in the public link. */
  id: string;
  companyId: string;
  plantId: string | null;
  moduleId: string;
  moduleTitle: string;
  contractorId: string;
  contractorName: string;
  technicianId: string;
  technicianName: string;
  technicianNic: string;
  technicianDesignation: string;
  technicianEmail: string;
  technicianPhone: string;
  assignedBy: string;
  assignedByName: string;
  assignedAt: Timestamp | null;
  /** Link closes at this moment. */
  dueAt: Timestamp;
  maxAttempts: number;
  /** How many times the team member has submitted (max `maxAttempts`). */
  attemptsUsed: number;
  /**
   * Only the final submission is kept — a new submission replaces the one
   * before it, and `attemptsUsed` carries the count. New data therefore holds
   * at most one entry; invites submitted before this was introduced may still
   * hold more, so read it through {@link getFinalAttempt}.
   */
  attempts: SafetyTrainingAttempt[];
  status: ContractorTrainingStatus;
  hasQuiz: boolean;
  passingScore: number;
  /** Score (%) of the final submission; null when there is no quiz or nothing submitted yet. */
  latestScore: number | null;
  lastSubmittedAt: Timestamp | null;
  emailStatus: InviteEmailStatus;
  emailSentAt?: Timestamp | null;
  signOff?: {
    by: string;
    byName: string;
    /** The signing officer's job title, printed on the safety card. */
    byTitle?: string;
    at: Timestamp | null;
    note: string;
    /** The officer's hand-drawn signature (PNG data URL). Absent on sign-offs made before it was required. */
    signatureDataUrl?: string;
    /** Qualifications (from the team member's profile) the officer checked and verified; only these are printed on the card. */
    verifiedQualifications?: string[];
  } | null;
  /** Safety card issued after sign-off. */
  cardId?: string | null;
  /** This invite replaced an earlier one (reassign) — or was replaced by `reassignedTo`. */
  reassignedFrom?: string | null;
  reassignedTo?: string | null;
}

/** Why a link can't take another submission. */
export type InviteClosedReason = 'signed_off' | 'reassigned' | 'attempts_exhausted' | 'expired';

export type InviteAccess =
  | { open: true; attemptsRemaining: number }
  | { open: false; reason: InviteClosedReason };

/**
 * Whether the team member can still submit. Mirrors the server check in
 * functions/src/safetyTraining/logic.js — the server is the authority, this
 * drives what the UI shows.
 */
export function getInviteAccess(
  inv: Pick<ContractorSafetyTrainingInvite, 'status' | 'attemptsUsed' | 'maxAttempts'> & { dueAtMs: number },
  nowMs: number = Date.now(),
): InviteAccess {
  if (inv.status === 'signed_off') return { open: false, reason: 'signed_off' };
  if (inv.status === 'reassigned') return { open: false, reason: 'reassigned' };
  const max = inv.maxAttempts > 0 ? inv.maxAttempts : MAX_SAFETY_TRAINING_ATTEMPTS;
  const remaining = max - (inv.attemptsUsed || 0);
  if (remaining <= 0) return { open: false, reason: 'attempts_exhausted' };
  if (nowMs > inv.dueAtMs) return { open: false, reason: 'expired' };
  return { open: true, attemptsRemaining: remaining };
}

/** What the safety officer's list shows for an invite. */
export type InviteDisplayStatus = 'awaiting' | 'submitted' | 'overdue' | 'signed_off' | 'reassigned';

export function getInviteDisplayStatus(
  inv: Pick<ContractorSafetyTrainingInvite, 'status' | 'attemptsUsed'> & { dueAtMs: number },
  nowMs: number = Date.now(),
): InviteDisplayStatus {
  if (inv.status === 'reassigned') return 'reassigned';
  if (inv.status === 'signed_off') return 'signed_off';
  if (inv.status === 'submitted' || (inv.attemptsUsed || 0) > 0) return 'submitted';
  return nowMs > inv.dueAtMs ? 'overdue' : 'awaiting';
}

/** The final (most recent) submission, or null when nothing has been submitted. */
export function getFinalAttempt(inv: Pick<ContractorSafetyTrainingInvite, 'attempts'>): SafetyTrainingAttempt | null {
  const list = inv.attempts ?? [];
  return list.length > 0 ? list[list.length - 1] : null;
}

/** Score (%) of the final submission — what marks, sign-off and the safety card are based on. */
export function getFinalScore(
  inv: Pick<ContractorSafetyTrainingInvite, 'attempts' | 'latestScore'>,
): number | null {
  const final = getFinalAttempt(inv);
  if (final) return typeof final.score === 'number' ? final.score : null;
  return typeof inv.latestScore === 'number' ? inv.latestScore : null;
}

export function inviteDueMillis(inv: Pick<ContractorSafetyTrainingInvite, 'dueAt'>): number {
  const ts = inv.dueAt as unknown as { toMillis?: () => number; seconds?: number } | null;
  if (ts?.toMillis) return ts.toMillis();
  return ts?.seconds ? ts.seconds * 1000 : 0;
}

// ---------------------------------------------------------------------------
// Contractor Safety Card
// ---------------------------------------------------------------------------

export type SafetyCardStatus = 'active' | 'revoked';

export interface ContractorSafetyCard {
  /** Doc id — encoded in the card's QR code. */
  id: string;
  companyId: string;
  plantId: string | null;
  companyName: string;
  plantName: string;
  /** Printed on the card, e.g. SC-2026-0007. */
  cardNumber: string;
  inviteId: string;
  moduleId: string;
  moduleTitle: string;
  /** Percentage from the signed-off attempt; null when the module has no quiz. */
  score: number | null;
  contractorId: string;
  contractorName: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactPersonPhone: string;
  technicianId: string;
  holderName: string;
  holderNic: string;
  holderPosition: string;
  /** The holder's related field(s) of work, e.g. "Electrical, HVAC". */
  holderField: string;
  /** Verified qualifications, e.g. "NVQ Level 4 — Welding". Empty when none were verified. */
  qualifications: string[];
  holderPhone: string;
  holderPhotoUrl: string;
  issuedAt: Timestamp | null;
  validUntil: Timestamp;
  issuedBy: string;
  issuedByName: string;
  /** Who signed the training off — shown with their signature on the back of the card. */
  signedOffByName?: string;
  signedOffByTitle?: string;
  signatureDataUrl?: string;
  status: SafetyCardStatus;
  revokedAt?: Timestamp | null;
  revokedBy?: string | null;
  revokedReason?: string | null;
}

export function isSafetyCardValid(
  card: Pick<ContractorSafetyCard, 'status' | 'validUntil'>,
  nowMs: number = Date.now(),
): boolean {
  if (card.status !== 'active') return false;
  const ts = card.validUntil as unknown as { toMillis?: () => number; seconds?: number } | null;
  const end = ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : 0;
  return end > nowMs;
}

/** Adds whole calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** Public form link sent to a contractor team member. */
export function buildSafetyTrainingLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/safety-training/${encodeURIComponent(token)}`;
}

/** What the card's QR code encodes — opens the safety-case report for the holder. */
export function buildSafetyCardUrl(baseUrl: string, cardId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/safety-card?id=${encodeURIComponent(cardId)}`;
}

const CARD_ID_PATTERN = /^[A-Za-z0-9]{15,40}$/;

/**
 * Pulls the card id out of whatever a scan produced: the card's QR URL, a
 * JSON payload, or a bare id. Returns null for anything else (e.g. a machine
 * or part QR code).
 */
export function parseSafetyCardScan(text: string): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.pathname.replace(/\/+$/, '') === '/safety-card') {
      const id = url.searchParams.get('id');
      return id && CARD_ID_PATTERN.test(id) ? id : null;
    }
    return null;
  } catch {
    // not a URL
  }
  try {
    const parsed = JSON.parse(raw) as { type?: unknown; id?: unknown };
    if (parsed && parsed.type === 'safety_card' && typeof parsed.id === 'string' && CARD_ID_PATTERN.test(parsed.id)) {
      return parsed.id;
    }
    return null;
  } catch {
    // not JSON
  }
  return CARD_ID_PATTERN.test(raw) ? raw : null;
}
