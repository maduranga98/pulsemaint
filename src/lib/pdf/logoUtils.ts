/** jsPDF's addImage needs a format matching the actual image data — a data URL's mime type tells us which. */
export function imageFormatFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,/.exec(dataUrl);
  const type = (match?.[1] ?? 'png').toLowerCase();
  if (type === 'jpg' || type === 'jpeg') return 'JPEG';
  if (type === 'webp') return 'WEBP';
  return 'PNG';
}

/**
 * Fetches a Storage logo URL and converts it to a data URL, for callers that
 * only have `company.logoUrl` (the durable field) rather than the
 * opportunistically-cached `company.logoDataUrl`.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
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
    console.error('Failed to load company logo', err);
    return null;
  }
}

/** Resolves the best available logo data URL for a company: cached data URL first, else fetched from Storage. */
export async function resolveCompanyLogoDataUrl(
  company: { logoDataUrl?: string | null; logoUrl?: string | null } | null | undefined,
): Promise<string | null> {
  if (!company) return null;
  if (company.logoDataUrl) return company.logoDataUrl;
  if (company.logoUrl) return fetchImageAsDataUrl(company.logoUrl);
  return null;
}
