import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import { buildCertificateNumber } from '@/lib/training/certificatePdf';
import type { CompanyProfile } from '@/types/auth';

interface IssueCertificateInput {
  assignment: TrainingAssignment;
  company: CompanyProfile | null;
  issuedBy: string;
  issuedByName: string;
  practicalObservations: string;
}

/**
 * Writes the trainee's certificate when their practical assessment is signed
 * off.
 *
 * Nothing used to create these documents — `triggerCertificateGeneration`
 * existed but was never called from anywhere — so a trainee who had been
 * signed off still saw an empty My Certificates page. Issuing it here, on the
 * same action that certifies them, means the certificate exists the moment
 * they are certified.
 *
 * Idempotent: a second sign-off on the same assignment (e.g. a retry after a
 * partial failure) reuses the existing certificate rather than issuing a
 * duplicate.
 */
export async function issueTrainingCertificate({
  assignment,
  company,
  issuedBy,
  issuedByName,
  practicalObservations,
}: IssueCertificateInput): Promise<string | null> {
  try {
    const existing = await getDocs(
      query(
        collection(db, 'trainingCertificates'),
        where('companyId', '==', assignment.companyId),
        where('assignmentId', '==', assignment.id),
        limit(1),
      ),
    );
    if (!existing.empty) return existing.docs[0].id;

    const ref = await addDoc(collection(db, 'trainingCertificates'), {
      certificateNumber: buildCertificateNumber(),
      companyId: assignment.companyId,
      companyName: company?.name ?? '',
      traineeId: assignment.traineeId,
      traineeName: assignment.traineeName,
      traineeNic: '',
      traineeDesignation: assignment.traineeRole ?? '',
      moduleId: assignment.moduleId,
      moduleName: assignment.moduleName,
      moduleCategory: assignment.moduleCategory ?? null,
      machineId: assignment.machineId ?? '',
      machineName: assignment.machineName ?? '',
      machineType: '',
      providerName: assignment.providerName ?? '',
      issuedBy,
      issuedByName,
      issuedAt: serverTimestamp(),
      expiryDate: null,
      isExpired: false,
      quizScore: assignment.bestScore ?? 0,
      practicalObservations,
      // Rendered on demand from the company's own letterhead
      // (lib/training/certificatePdf) rather than stored as a file.
      pdfUrl: '',
      assignmentId: assignment.id,
      isRevoked: false,
      revokedAt: null,
      revokedBy: null,
      revokedReason: null,
    });
    return ref.id;
  } catch (err) {
    // Certificate issuance must never fail the sign-off itself — the
    // assignment is already certified either way.
    console.error('Failed to issue training certificate', err);
    return null;
  }
}
