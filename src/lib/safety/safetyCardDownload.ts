import { useAuthStore } from '@/store/authStore';
import { fetchImageAsDataUrl, resolveCompanyLogoDataUrl } from '@/lib/pdf/logoUtils';
import type { ContractorSafetyCard } from '@/lib/safety/contractorSafety';
import { cropToAspect } from '@/lib/safety/imageCrop';
import {
  SAFETY_CARD_PHOTO_ASPECT,
  SAFETY_CARD_PHOTO_FOCUS_Y,
  buildSafetyCardPdf,
  safetyCardFileName,
} from '@/lib/safety/safetyCardPdf';
import { getContractorTechnician } from '@/services/contractorSafetyTraining.service';

/**
 * Builds the card PDF and downloads it. Gathers what the PDF builder can't
 * know on its own: the issuing company's logo, its current name (a name or
 * logo corrected after the card was issued shows up on a reprint) and the
 * holder's photo, cropped to the passport-proportion frame.
 *
 * The photo is the team member's currently registered profile photo, so a
 * photo added or corrected after the card was issued shows up on a reprint;
 * the copy saved on the card is only the fallback (record deleted, no access).
 */
export async function downloadSafetyCardPdf(card: ContractorSafetyCard): Promise<void> {
  const company = useAuthStore.getState().company;
  const sameCompany = !!company && (!company.id || company.id === card.companyId);

  const photoUrl = async () => {
    const live = await getContractorTechnician(card.contractorId, card.technicianId);
    return live?.photoUrl || card.holderPhotoUrl || '';
  };
  const [logoDataUrl, rawPhoto] = await Promise.all([
    sameCompany ? resolveCompanyLogoDataUrl(company) : Promise.resolve(null),
    photoUrl().then((url) => (url ? fetchImageAsDataUrl(url) : null)),
  ]);
  const photoDataUrl = rawPhoto
    ? await cropToAspect(rawPhoto, SAFETY_CARD_PHOTO_ASPECT, 600, SAFETY_CARD_PHOTO_FOCUS_Y)
    : null;

  const liveName = sameCompany ? company?.name || company?.tradeName : null;
  const doc = await buildSafetyCardPdf(
    { ...card, companyName: liveName || card.companyName },
    { photoDataUrl, logoDataUrl },
  );
  doc.save(safetyCardFileName(card));
}
