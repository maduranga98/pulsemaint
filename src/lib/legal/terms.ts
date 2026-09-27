/**
 * FirmiCore Terms of Service, including the subscription & billing terms that
 * every company admin accepts when registering, adding a card and starting a
 * paid plan. The text is translated into every app language; the English
 * version governs (see §15).
 *
 * Bump TERMS_VERSION whenever the text changes materially: each acceptance
 * is recorded with the version that was shown. Format: YYYY-MM-DD, with an
 * optional ".n" for a second revision on the same day.
 */
export const TERMS_VERSION = '2026-09-27.2';
export const TERMS_EFFECTIVE_DATE = '27 September 2026';

/** The provider, as registered at Companies House (England and Wales). */
export const PROVIDER = {
  name: 'Lumora Ventures PVT Ltd',
  companyNumber: '16159220',
  ukOffice: 'Office 4157, 58 Peregrine Road, Hainault, Ilford, Essex, IG6 3SZ, United Kingdom',
  lkOffice: 'Kurunegala Road, Kuliyapitiya 60200, Sri Lanka',
  phone: '+94 71 999 8500',
  email: 'info@lumoraventures.com',
  website: 'https://lumoraventures.com',
};

/**
 * Section ids and paragraph counts. The text itself lives in the locale
 * files under common.legal.termsContent.<id>.{title,p1..pn} so it can be
 * read in every supported language; PROVIDER fills its {{placeholders}}.
 */
export const TERMS_SECTIONS: { id: string; paragraphs: number }[] = [
  { id: 'provider', paragraphs: 3 },
  { id: 'agreement', paragraphs: 3 },
  { id: 'accounts', paragraphs: 2 },
  { id: 'plans', paragraphs: 2 },
  { id: 'autoRenewal', paragraphs: 3 },
  { id: 'changes', paragraphs: 1 },
  { id: 'failedPayments', paragraphs: 2 },
  { id: 'cancellation', paragraphs: 2 },
  { id: 'suspension', paragraphs: 2 },
  { id: 'dataRetention', paragraphs: 4 },
  { id: 'privacy', paragraphs: 3 },
  { id: 'acceptableUse', paragraphs: 2 },
  { id: 'breach', paragraphs: 3 },
  { id: 'liability', paragraphs: 2 },
  { id: 'law', paragraphs: 4 },
];
