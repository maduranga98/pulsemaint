import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { CompanyProfile } from '../types/auth';

/**
 * Generated documents (reports, service letters, shift handovers, training
 * certificates) embed the company logo via jsPDF's addImage, which needs a
 * data URL rather than a remote Storage URL. Companies whose logo was
 * uploaded before logoDataUrl existed — or anyone who registered without
 * ever opening Settings > Company Profile, which used to be the only place
 * this conversion ran — only have logoUrl set, so their logo silently never
 * appears anywhere a PDF gets generated. Best-effort backfill it once per
 * company; no-ops if there's nothing to do or the fetch fails (e.g. no CORS
 * rule on the bucket for this origin).
 */
export async function backfillCompanyLogoDataUrl(
  company: Pick<CompanyProfile, 'id' | 'logoUrl' | 'logoDataUrl'>,
): Promise<string | null> {
  if (!company.logoUrl || company.logoDataUrl) return null;
  try {
    const res = await fetch(company.logoUrl);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await updateDoc(doc(db, 'companies', company.id), { logoDataUrl: dataUrl });
    return dataUrl;
  } catch {
    return null;
  }
}
