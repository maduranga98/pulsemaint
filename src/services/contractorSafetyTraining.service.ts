import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { nanoid } from 'nanoid';
import { db, functions } from '@/lib/firebase';
import {
  MAX_SAFETY_TRAINING_ATTEMPTS,
  type ContractorSafetyCard,
  type ContractorSafetyTrainingInvite,
  type InviteEmailStatus,
} from '@/lib/safety/contractorSafety';
import {
  SPECIALIZATION_LABELS,
  type Contractor,
  type ContractorTechnician,
} from '@/lib/contractors/contractorTypes';
import type { TrainingModule } from '@/lib/training/trainingTypes';

const INVITES = 'safetyTrainingInvites';
const CARDS = 'safetyCertificates';

export const TECHNICIAN_DESIGNATION_LABELS: Record<string, string> = {
  engineer: 'Engineer',
  senior_technician: 'Senior Technician',
  technician: 'Technician',
  helper: 'Helper',
  other: 'Other',
};

export interface Assigner {
  id: string;
  name: string;
}

// ── Invites ────────────────────────────────────────────────────────────────

export function subscribeContractorInvites(
  companyId: string,
  cb: (invites: ContractorSafetyTrainingInvite[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, INVITES), where('companyId', '==', companyId)),
    (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ContractorSafetyTrainingInvite)),
    (err) => onError?.(err.message),
  );
}

interface InviteModuleInfo {
  id: string;
  title: string;
  hasQuiz: boolean;
  passingScore: number;
}

/** What an invite records about its module (the public form reads the live module itself). */
export function inviteModuleInfo(module: Pick<TrainingModule, 'id' | 'title' | 'quiz' | 'passingScore'>): InviteModuleInfo {
  return {
    id: module.id,
    title: module.title,
    hasQuiz: (module.quiz?.questions?.length ?? 0) > 0,
    passingScore: module.quiz?.passingScore ?? module.passingScore ?? 80,
  };
}

interface NewInviteSource {
  companyId: string;
  plantId: string | null;
  module: InviteModuleInfo;
  contractor: Pick<Contractor, 'id' | 'companyName'>;
  technician: Pick<ContractorTechnician, 'id' | 'fullName' | 'nicOrPassport' | 'designation' | 'email' | 'phone'>;
  dueAt: Date;
  assigner: Assigner;
}

function inviteDoc(src: NewInviteSource, reassignedFrom: string | null) {
  return {
    companyId: src.companyId,
    plantId: src.plantId,
    moduleId: src.module.id,
    moduleTitle: src.module.title,
    contractorId: src.contractor.id,
    contractorName: src.contractor.companyName,
    technicianId: src.technician.id,
    technicianName: src.technician.fullName,
    technicianNic: src.technician.nicOrPassport ?? '',
    technicianDesignation: src.technician.designation ?? '',
    technicianEmail: src.technician.email?.trim() ?? '',
    technicianPhone: src.technician.phone?.trim() ?? '',
    assignedBy: src.assigner.id,
    assignedByName: src.assigner.name,
    assignedAt: serverTimestamp(),
    dueAt: Timestamp.fromDate(src.dueAt),
    maxAttempts: MAX_SAFETY_TRAINING_ATTEMPTS,
    attemptsUsed: 0,
    attempts: [],
    status: 'assigned',
    hasQuiz: src.module.hasQuiz,
    passingScore: src.module.passingScore,
    bestScore: null,
    latestScore: null,
    lastSubmittedAt: null,
    emailStatus: (src.technician.email?.trim() ? 'pending' : 'no_email') as InviteEmailStatus,
    signOff: null,
    cardId: null,
    reassignedFrom,
    reassignedTo: null,
  };
}

export interface EmailResult {
  inviteId: string;
  status: 'sent' | 'failed' | 'no_email' | 'closed' | 'not_found';
}

/** Emails the training link to the invited team members (best effort — the invite exists either way). */
export async function sendInviteEmails(inviteIds: string[]): Promise<EmailResult[]> {
  if (inviteIds.length === 0) return [];
  try {
    const call = httpsCallable<{ inviteIds: string[] }, { results: EmailResult[] }>(
      functions,
      'sendContractorSafetyTrainingInvites',
    );
    const res = await call({ inviteIds });
    return res.data.results;
  } catch (err) {
    console.error('Failed to email safety training links', err);
    return inviteIds.map((inviteId) => ({ inviteId, status: 'failed' as const }));
  }
}

/** Creates one link-invite per selected team member, then emails the links. */
export async function assignContractorSafetyTraining(input: {
  companyId: string;
  plantId: string | null;
  module: Pick<TrainingModule, 'id' | 'title' | 'quiz' | 'passingScore'>;
  contractor: NewInviteSource['contractor'];
  technicians: NewInviteSource['technician'][];
  dueAt: Date;
  assigner: Assigner;
}): Promise<{ inviteIds: string[]; emails: EmailResult[] }> {
  const batch = writeBatch(db);
  const inviteIds: string[] = [];
  for (const technician of input.technicians) {
    const token = nanoid(32);
    inviteIds.push(token);
    batch.set(doc(db, INVITES, token), inviteDoc({ ...input, module: inviteModuleInfo(input.module), technician }, null));
  }
  await batch.commit();
  const emails = await sendInviteEmails(inviteIds);
  return { inviteIds, emails };
}

/**
 * Replaces an invite with a fresh link, attempts reset and a new due
 * date/time. The old link closes; its submissions stay on record.
 */
export async function reassignInvite(
  old: ContractorSafetyTrainingInvite,
  dueAt: Date,
  assigner: Assigner,
  technician: Pick<ContractorTechnician, 'fullName' | 'nicOrPassport' | 'designation' | 'email' | 'phone'> | null,
): Promise<{ inviteId: string; email: EmailResult | null }> {
  const token = nanoid(32);
  const source: NewInviteSource = {
    companyId: old.companyId,
    plantId: old.plantId ?? null,
    module: { id: old.moduleId, title: old.moduleTitle, hasQuiz: old.hasQuiz, passingScore: old.passingScore },
    contractor: { id: old.contractorId, companyName: old.contractorName },
    technician: {
      id: old.technicianId,
      fullName: technician?.fullName ?? old.technicianName,
      nicOrPassport: technician?.nicOrPassport ?? old.technicianNic,
      designation: (technician?.designation ?? old.technicianDesignation) as ContractorTechnician['designation'],
      email: technician?.email ?? old.technicianEmail,
      phone: technician?.phone ?? old.technicianPhone,
    },
    dueAt,
    assigner,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, INVITES, token), inviteDoc(source, old.id));
  batch.update(doc(db, INVITES, old.id), { status: 'reassigned', reassignedTo: token });
  await batch.commit();
  const [email] = await sendInviteEmails([token]);
  return { inviteId: token, email: email ?? null };
}

export async function signOffInvite(inviteId: string, note: string, by: Assigner): Promise<void> {
  await updateDoc(doc(db, INVITES, inviteId), {
    status: 'signed_off',
    signOff: { by: by.id, byName: by.name, at: Timestamp.now(), note: note.trim() },
  });
}

/** Current record of a contractor team member (for fresh contact details when reassigning/issuing). */
export async function getContractorTechnician(
  contractorId: string,
  technicianId: string,
): Promise<ContractorTechnician | null> {
  try {
    const snap = await getDoc(doc(db, 'contractors', contractorId, 'technicians', technicianId));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as ContractorTechnician) : null;
  } catch {
    return null;
  }
}

// ── Safety cards ───────────────────────────────────────────────────────────

export function subscribeSafetyCards(
  companyId: string,
  cb: (cards: ContractorSafetyCard[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, CARDS), where('companyId', '==', companyId)),
    (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ContractorSafetyCard)),
    (err) => onError?.(err.message),
  );
}

export async function getSafetyCard(cardId: string): Promise<ContractorSafetyCard | null> {
  const snap = await getDoc(doc(db, CARDS, cardId));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as ContractorSafetyCard) : null;
}

/** "Electrical, HVAC" — the technician's own fields, else the contractor's. */
export function describeField(
  technician: Pick<ContractorTechnician, 'specialization'> | null | undefined,
  contractor: Pick<Contractor, 'specializationTags'> | null | undefined,
): string {
  const tags = technician?.specialization?.length ? technician.specialization : (contractor?.specializationTags ?? []);
  return tags.map((tag) => SPECIALIZATION_LABELS[tag] ?? tag).join(', ');
}

/**
 * Issues a Contractor Safety Card for a signed-off invite. Contractor and
 * team-member details are snapshotted so the printed card stays consistent
 * with what was issued.
 */
export async function issueSafetyCard(input: {
  invite: ContractorSafetyTrainingInvite;
  contractor: Contractor;
  technician: ContractorTechnician | null;
  companyName: string;
  plantName: string;
  validUntil: Date;
  issuer: Assigner;
}): Promise<string> {
  const { invite, contractor, technician } = input;
  const cardRef = doc(collection(db, CARDS));
  const year = new Date().getFullYear();
  const contactName = contractor.primaryContactName ?? '';
  const batch = writeBatch(db);
  batch.set(cardRef, {
    companyId: invite.companyId,
    plantId: invite.plantId ?? null,
    companyName: input.companyName,
    plantName: input.plantName,
    cardNumber: `SC-${year}-${cardRef.id.slice(0, 6).toUpperCase()}`,
    inviteId: invite.id,
    moduleId: invite.moduleId,
    moduleTitle: invite.moduleTitle,
    score: invite.bestScore ?? null,
    contractorId: contractor.id,
    contractorName: contractor.companyName,
    contactPersonName: contactName,
    contactPersonDesignation: contractor.primaryContactDesig ?? '',
    contactPersonPhone: contractor.primaryPhone ?? '',
    technicianId: invite.technicianId,
    holderName: technician?.fullName ?? invite.technicianName,
    holderNic: technician?.nicOrPassport ?? invite.technicianNic,
    holderPosition:
      TECHNICIAN_DESIGNATION_LABELS[technician?.designation ?? invite.technicianDesignation] ??
      (technician?.designation ?? invite.technicianDesignation),
    holderField: describeField(technician, contractor),
    holderPhone: technician?.phone ?? invite.technicianPhone ?? '',
    holderPhotoUrl: technician?.photoUrl ?? '',
    issuedAt: serverTimestamp(),
    validUntil: Timestamp.fromDate(input.validUntil),
    issuedBy: input.issuer.id,
    issuedByName: input.issuer.name,
    status: 'active',
    revokedAt: null,
    revokedBy: null,
    revokedReason: null,
  });
  batch.update(doc(db, INVITES, invite.id), { cardId: cardRef.id });
  await batch.commit();
  return cardRef.id;
}

export async function revokeSafetyCard(cardId: string, reason: string, by: Assigner): Promise<void> {
  await updateDoc(doc(db, CARDS, cardId), {
    status: 'revoked',
    revokedAt: Timestamp.now(),
    revokedBy: by.id,
    revokedReason: reason.trim(),
  });
}

// ── Public form (no login) ─────────────────────────────────────────────────

export interface PublicQuizOption {
  id: string;
  text: string;
}
export interface PublicQuizQuestion {
  id: string;
  order: number;
  text: string;
  type: 'single_choice' | 'multiple_choice' | 'true_false';
  imageUrl: string;
  points: number;
  options: PublicQuizOption[];
}
export interface PublicLesson {
  id: string;
  order: number;
  title: string;
  type: 'video' | 'document' | 'image_gallery' | 'text';
  contentUrl: string;
  thumbnailUrl: string;
  description: string;
  durationSeconds: number;
  isRequired: boolean;
}
export interface PublicAttemptSummary {
  attemptNumber: number;
  submittedAtMs: number;
  hasQuiz: boolean;
  score: number | null;
  passed: boolean;
  attachmentCount: number;
}
export interface PublicSafetyTrainingForm {
  invite: {
    technicianName: string;
    contractorName: string;
    moduleTitle: string;
    companyName: string;
    plantName: string;
    timezone: string;
    dueAtMs: number;
    maxAttempts: number;
    attemptsUsed: number;
    hasQuiz: boolean;
    passingScore: number;
    status: 'assigned' | 'submitted' | 'signed_off' | 'reassigned';
  };
  access:
    | { open: true; attemptsRemaining: number }
    | { open: false; reason: 'signed_off' | 'reassigned' | 'attempts_exhausted' | 'expired' };
  content: {
    title: string;
    description: string;
    lessons: PublicLesson[];
    quiz: {
      title: string;
      instructions: string;
      shuffleQuestions: boolean;
      shuffleOptions: boolean;
      questions: PublicQuizQuestion[];
    } | null;
  } | null;
  attempts: PublicAttemptSummary[];
}

export interface PublicSubmissionAttachment {
  name: string;
  mimeType: string;
  /** base64, no data: prefix */
  data: string;
}

export interface PublicSubmissionResult {
  attemptNumber: number;
  attemptsRemaining: number;
  hasQuiz: boolean;
  score: number | null;
  passed: boolean;
  passingScore: number;
  canRetry: boolean;
}

export async function fetchSafetyTrainingForm(token: string): Promise<PublicSafetyTrainingForm> {
  const call = httpsCallable<{ token: string }, PublicSafetyTrainingForm>(functions, 'getContractorSafetyTrainingForm');
  return (await call({ token })).data;
}

export async function submitSafetyTrainingForm(input: {
  token: string;
  answers: Record<string, string[]>;
  notes: string;
  declarationName: string;
  acknowledged: boolean;
  attachments: PublicSubmissionAttachment[];
}): Promise<PublicSubmissionResult> {
  const call = httpsCallable<typeof input, PublicSubmissionResult>(functions, 'submitContractorSafetyTraining');
  return (await call(input)).data;
}
