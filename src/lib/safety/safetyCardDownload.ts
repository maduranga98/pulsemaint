import { useAuthStore } from '@/store/authStore';
import { fetchImageAsDataUrl, resolveCompanyLogoDataUrl } from '@/lib/pdf/logoUtils';
import type { ContractorSafetyCard } from '@/lib/safety/contractorSafety';
import { cropToAspect } from '@/lib/safety/imageCrop';
import {
  SAFETY_CARD_PHOTO_ASPECT,
  buildSafetyCardPdf,
  safetyCardFileName,
} from '@/lib/safety/safetyCardPdf';

/**
 * Builds the card PDF and downloads it. Gathers what the PDF builder can't
 * know on its own: the issuing company's logo, its current name (a name or
 * logo corrected after the card was issued shows up on a reprint) and the
 * holder's photo, cropped to fill its frame.
 */
export async function downloadSafetyCardPdf(card: ContractorSafetyCard): Promise<void> {
  const company = useAuthStore.getState().company;
  const sameCompany = !!company && (!company.id || company.id === card.companyId);

  const [logoDataUrl, rawPhoto] = await Promise.all([
    sameCompany ? resolveCompanyLogoDataUrl(company) : Promise.resolve(null),
    card.holderPhotoUrl ? fetchImageAsDataUrl(card.holderPhotoUrl) : Promise.resolve(null),
  ]);
  const photoDataUrl = rawPhoto ? await cropToAspect(rawPhoto, SAFETY_CARD_PHOTO_ASPECT) : null;

  const liveName = sameCompany ? company?.name || company?.tradeName : null;
  const doc = await buildSafetyCardPdf(
    { ...card, companyName: liveName || card.companyName },
    { photoDataUrl, logoDataUrl },
  );
  doc.save(safetyCardFileName(card));
}
