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
  issuedBy: { name: string; role: string };
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
 * download. Generated entirely client-side — not persisted.
 */
export async function generateServiceLetter(input: GenerateServiceLetterInput): Promise<void> {
  const { company, employee, roleLabel, form, issuedBy, signatureImageDataUrl } = input;
  const logoDataUrl = company.logoUrl ? await fetchImageAsDataUrl(company.logoUrl) : null;

  const pdf = buildServiceLetterPdf({
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
}
