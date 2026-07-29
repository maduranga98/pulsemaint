import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notifyUsers } from '@/services/notifications.service';
import type { CompanyProfile, UserProfile } from '@/types/auth';
import { buildServiceLetterPdf } from './serviceLetterPdf';

export interface ServiceLetterFormInput {
  subject: string;
  addressedTo: string;
  body: string;
  remarks: string;
}

interface GenerateServiceLetterInput {
  company: CompanyProfile;
  employee: UserProfile;
  roleLabel: string;
  form: ServiceLetterFormInput;
  issuedBy: { id: string; name: string; role: string };
  /** Optional data URL of a manually attached digital signature image, rendered in place of the typed-name signature. */
  signatureImageDataUrl?: string | null;
}

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
    console.error('Failed to load company logo for service letter', err);
    return null;
  }
}

function timestampToDate(ts: unknown): Date | null {
  const t = ts as { toDate?: () => Date; seconds?: number } | null | undefined;
  if (!t) return null;
  return t.toDate ? t.toDate() : t.seconds ? new Date(t.seconds * 1000) : null;
}

/**
 * Builds a Service Letter PDF for the given employee, using the company's
 * profile (logo + description) as the letterhead, and triggers a browser
 * download. The PDF itself is generated client-side and not persisted, but
 * an audit record (who was issued a letter, by whom, when) is logged to
 * `serviceLetterHistory` for the export history view.
 *
 * Returns whether the company logo actually made it into the letter, so
 * the caller can warn the admin if it didn't (e.g. no logo uploaded yet, or
 * the upload predates logoDataUrl and the network fetch fallback failed).
 */
export async function generateServiceLetter(input: GenerateServiceLetterInput): Promise<{ logoEmbedded: boolean }> {
  const { company, employee, roleLabel, form, issuedBy, signatureImageDataUrl } = input;
  // Prefer the data URL captured at upload time — fetching the Storage
  // download URL cross-origin can fail silently if the bucket has no CORS
  // rule for this origin, which used to make the logo vanish from letters.
  const logoDataUrl = company.logoDataUrl || (company.logoUrl ? await fetchImageAsDataUrl(company.logoUrl) : null);

  const { doc: pdf, logoEmbedded } = buildServiceLetterPdf({
    companyName: company.name,
    companyAddress: company.address,
    companyPhone: company.phone,
    companyEmail: company.email,
    companyDescription: company.description,
    companyLogoDataUrl: logoDataUrl,
    signatureImageDataUrl: signatureImageDataUrl ?? null,

    employeeName: employee.fullName,
    employeeId: employee.employeeId,
    jobTitle: employee.jobTitle,
    department: employee.department,
    role: roleLabel,
    joinedDate: timestampToDate(employee.createdAt),
    address: employee.address,

    letterDate: new Date(),
    subject: form.subject,
    addressedTo: form.addressedTo,
    body: form.body,
    remarks: form.remarks,

    issuedByName: issuedBy.name,
    issuedByRole: issuedBy.role,
  });

  const fileName = `Service-Letter-${employee.fullName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);

  try {
    await addDoc(collection(db, 'serviceLetterHistory'), {
      companyId: company.id,
      issuedAt: serverTimestamp(),
      subject: form.subject,
      toUserId: employee.id,
      toName: employee.fullName,
      toRole: roleLabel,
      byUserId: issuedBy.id,
      byName: issuedBy.name,
      byRole: issuedBy.role,
    });
  } catch (err) {
    // The letter itself already downloaded successfully — a failed audit
    // log entry shouldn't be surfaced as a generation failure.
    console.error('Failed to record service letter history', err);
  }

  void notifyUsers(company.id, [employee.id], {
    type: 'document',
    message: `A service letter ("${form.subject}") has been issued for you by ${issuedBy.name}`,
    oversightMessage: `issued a service letter ("${form.subject}") for ${employee.fullName}`,
    actorName: issuedBy.name,
  });

  return { logoEmbedded };
}
