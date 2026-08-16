import { doc, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { USER_ROLE_LABELS } from '../../constants/copy';
import { buildProgrammeCertificatePdf } from './programmeCertificatePdf';
import type { CompanyProfile, UserProfile } from '../../types/auth';
import type { ProgrammeDuration, ProgrammeDurationPreset, ProgrammeModuleResult } from '../../types/traineeProgram';

interface IssueProgrammeCertificateInput {
  companyId: string;
  company: CompanyProfile;
  programmeId: string;
  trainee: { id: string; fullName: string; employeeId: string | null };
  durationMonths: ProgrammeDuration;
  durationPreset: ProgrammeDurationPreset;
  startDate: Date;
  moduleResults: ProgrammeModuleResult[];
  finalMark: number;
  recommendation: string;
  recommender: UserProfile;
  /** PNG data URL of the authorizer's digital signature, if captured. */
  signatureImageDataUrl?: string | null;
}

// Prefer the data URL captured at upload time — fetching the Storage
// download URL cross-origin can fail silently if the bucket has no CORS
// rule for this origin (same fallback used by service letters).
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Failed to load company logo for programme certificate', err);
    return null;
  }
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
  const { company } = input;
  const companyLogoDataUrl = company.logoDataUrl || (company.logoUrl ? await fetchImageAsDataUrl(company.logoUrl) : null);

  const pdf = buildProgrammeCertificatePdf({
    certificateNumber,
    companyName: company.name,
    companyDescription: company.description,
    companyAddress: company.address,
    companyPhone: company.phone,
    companyEmail: company.email,
    companyLogoDataUrl,
    traineeName: input.trainee.fullName,
    traineeEmployeeId: input.trainee.employeeId,
    durationMonths: input.durationMonths,
    durationPreset: input.durationPreset,
    startDate: input.startDate,
    completedDate,
    moduleResults: input.moduleResults,
    finalMark: input.finalMark,
    recommendation: input.recommendation,
    recommendedByName: input.recommender.fullName,
    recommendedByRole,
    signatureImageDataUrl: input.signatureImageDataUrl ?? null,
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
    companyName: company.name,
    programmeId: input.programmeId,
    traineeId: input.trainee.id,
    traineeName: input.trainee.fullName,
    traineeEmployeeId: input.trainee.employeeId,
    durationMonths: input.durationMonths,
    durationPreset: input.durationPreset,
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
