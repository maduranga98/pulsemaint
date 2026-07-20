import { doc, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { USER_ROLE_LABELS } from '../../constants/copy';
import { buildProgrammeCertificatePdf } from './programmeCertificatePdf';
import type { UserProfile } from '../../types/auth';
import type { ProgrammeDuration, ProgrammeModuleResult } from '../../types/traineeProgram';

interface IssueProgrammeCertificateInput {
  companyId: string;
  companyName: string;
  programmeId: string;
  trainee: { id: string; fullName: string; employeeId: string | null };
  durationMonths: ProgrammeDuration;
  startDate: Date;
  moduleResults: ProgrammeModuleResult[];
  finalMark: number;
  recommendation: string;
  recommender: UserProfile;
}

/**
 * Generates the programme completion certificate PDF client-side, uploads it
 * to Storage, and writes the traineeProgrammeCertificates record. Returns the
 * new certificate document's ID.
 */
export async function issueProgrammeCertificate(input: IssueProgrammeCertificateInput): Promise<string> {
  const counterRef = doc(db, 'traineeProgrammeCertCounters', input.companyId);
  const certificateNumber = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const count = ((counterSnap.data()?.count as number) ?? 0) + 1;
    tx.set(counterRef, { count }, { merge: true });
    return `TRN-CERT-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
  });

  const completedDate = new Date();
  const recommendedByRole = USER_ROLE_LABELS[input.recommender.role] ?? input.recommender.role;

  const pdf = buildProgrammeCertificatePdf({
    certificateNumber,
    companyName: input.companyName,
    traineeName: input.trainee.fullName,
    traineeEmployeeId: input.trainee.employeeId,
    durationMonths: input.durationMonths,
    startDate: input.startDate,
    completedDate,
    moduleResults: input.moduleResults,
    finalMark: input.finalMark,
    recommendation: input.recommendation,
    recommendedByName: input.recommender.fullName,
    recommendedByRole,
  });
  const pdfBlob = pdf.output('blob');

  const certRef = doc(db, 'traineeProgrammeCertificates', `${input.programmeId}_${Date.now()}`);
  const pdfStoragePath = `companies/${input.companyId}/trainee-programmes/certificates/${certRef.id}.pdf`;
  const fileRef = storageRef(storage, pdfStoragePath);
  await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' });
  const pdfUrl = await getDownloadURL(fileRef);

  await setDoc(certRef, {
    id: certRef.id,
    certificateNumber,
    companyId: input.companyId,
    companyName: input.companyName,
    programmeId: input.programmeId,
    traineeId: input.trainee.id,
    traineeName: input.trainee.fullName,
    traineeEmployeeId: input.trainee.employeeId,
    durationMonths: input.durationMonths,
    startDate: Timestamp.fromDate(input.startDate),
    completedDate: Timestamp.fromDate(completedDate),
    moduleResults: input.moduleResults,
    finalMark: input.finalMark,
    recommendation: input.recommendation,
    recommendedBy: input.recommender.id,
    recommendedByName: input.recommender.fullName,
    recommendedByRole,
    issuedAt: serverTimestamp(),
    pdfUrl,
    pdfStoragePath,
  });

  return certRef.id;
}
