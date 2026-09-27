/**
 * FirmiCore Terms of Service, including the subscription & billing terms that
 * every company admin accepts when registering, adding a card and starting a
 * paid plan. The legal text is kept in English (the governing version, see
 * §15) — only the surrounding UI is translated.
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
  registeredOffice: 'Office 4157, 58 Peregrine Road, Hainault, Ilford, Essex, IG6 3SZ, United Kingdom',
  website: 'https://lumoraventures.com',
  email: 'info@lumoraventures.com',
};

export interface TermsSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'provider',
    title: '1. Who we are',
    paragraphs: [
      `FirmiCore is provided by ${PROVIDER.name} ("Lumora Ventures", "we", "us"), a private limited company registered in England and Wales under company number ${PROVIDER.companyNumber}, with its registered office at ${PROVIDER.registeredOffice}. Website: ${PROVIDER.website}. Email: ${PROVIDER.email}.`,
      "These details are given in accordance with section 82 of the Companies Act 2006, the Company, Limited Liability Partnership and Business (Names and Trading Disclosures) Regulations 2015 (SI 2015/17) and regulation 6 of the Electronic Commerce (EC Directive) Regulations 2002 (SI 2002/2013).",
    ],
  },
  {
    id: 'agreement',
    title: '2. Agreement',
    paragraphs: [
      'These Terms of Service ("Terms") are a binding contract between Lumora Ventures and the company or organisation that registers a FirmiCore account ("the Company", "you"). The person who registers the account or accepts these Terms on the Company\'s behalf confirms that they are authorised to bind the Company.',
      'By ticking "I agree", registering, adding a payment card or starting a paid plan, you accept these Terms. If you do not agree, do not use FirmiCore.',
      'FirmiCore is supplied to businesses for business use. The Company confirms it is acting in the course of its business and not as a consumer, so the Consumer Rights Act 2015 (c. 15) and the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (SI 2013/3134) do not apply. Nothing in these Terms removes any right that cannot lawfully be excluded.',
    ],
  },
  {
    id: 'accounts',
    title: '3. Company account, users and roles',
    paragraphs: [
      'A FirmiCore account belongs to the Company, not to an individual. The Company admin may invite users and assign them roles (for example admin, plant manager, supervisor, technician, store keeper, HR officer, trainee, floor operator and safety officer).',
      'The Company is responsible for every user it invites, for keeping login details secure, and for all activity carried out under its account. Plan limits (such as the number of users, machines, inventory items, PM schedules and work orders) apply to the whole Company.',
    ],
  },
  {
    id: 'plans',
    title: '4. Plans and billing cycles',
    paragraphs: [
      'Paid plans are offered as separate Monthly and Yearly subscriptions. A Monthly subscription is billed every month; a Yearly subscription is billed once every 12 months at the yearly price shown when you subscribe. The two cycles are separate products: the price, the renewal date and the billing period differ, and choosing one does not include the other.',
      'Prices are shown in US dollars and exclude any taxes, bank or currency-conversion charges, which are the Company\'s responsibility. The plan limits and features that apply are those shown on the Billing & Plan page for the plan and cycle you subscribe to.',
    ],
  },
  {
    id: 'auto-renewal',
    title: '5. Automatic renewal and authorisation to charge',
    paragraphs: [
      'Subscriptions renew automatically. By subscribing, the Company authorises us, through our payment processor Stripe, to charge the default payment card on file the plan price at the start of each billing period — every month for a Monthly subscription, every year for a Yearly subscription — until the subscription is cancelled.',
      'One subscription covers the whole Company and all of its users and roles; individual users are not billed separately. Charges continue regardless of how many users log in or how much the service is used during a period.',
      'By adding a card you authorise Stripe to store it securely and to charge it for this subscription and for future renewals in accordance with these Terms. FirmiCore never receives or stores your full card number.',
    ],
  },
  {
    id: 'changes',
    title: '6. Upgrades, downgrades and switching cycles',
    paragraphs: [
      'The Company admin can change plan or switch between Monthly and Yearly billing from the Billing & Plan page. Changes take effect as shown at the time of the change; Stripe may prorate the difference, charge the difference immediately, or apply a credit to the next invoice.',
    ],
  },
  {
    id: 'failed-payments',
    title: '7. Failed or late payments',
    paragraphs: [
      'If a renewal charge fails, we (through Stripe) may retry the charge and notify the Company. If payment still cannot be collected, the subscription may be cancelled and access suspended as described in section 9.',
      'Amounts that remain unpaid after they fall due are a debt owed by the Company. We may charge statutory interest and compensation on late payments under the Late Payment of Commercial Debts (Interest) Act 1998 (c. 20), and recover the debt through the courts.',
    ],
  },
  {
    id: 'cancellation',
    title: '8. Cancellation',
    paragraphs: [
      'The Company admin can cancel the subscription at any time from the Billing & Plan page (Manage subscription). Cancellation stops future renewals; it takes effect at the end of the billing period that has already been paid for.',
      'Fees already paid are non-refundable, including for unused time in a Monthly or Yearly period, except where a refund is required by law.',
    ],
  },
  {
    id: 'suspension',
    title: '9. Loss of access when a subscription ends or payment fails',
    paragraphs: [
      'Access to FirmiCore is automatically suspended for every user and every role of the Company when the paid period ends after the subscription is cancelled, when a renewal remains unpaid, or when a payment problem means the subscription can no longer continue. Only the Company admin can still open the Billing & Plan page to start a new subscription.',
      'Suspension only removes access. It never deletes the Company\'s data: all records stay securely stored, unchanged, and become available again to all users as soon as a new subscription is active.',
    ],
  },
  {
    id: 'data-retention',
    title: '10. Your data is kept until you ask us to delete it',
    paragraphs: [
      'The Company\'s data is retained securely — whether the subscription is active, cancelled, unpaid, suspended or affected by any payment issue — for as long as the account exists, until the Company admin asks us to delete it. We will not delete the Company\'s data because a subscription ended or a payment failed.',
      'Only the Company admin (or another person the Company authorises in writing) can ask for all of the Company\'s data to be permanently deleted, by writing to ' + PROVIDER.email + ' from the admin\'s registered email address. We may verify the request before acting on it. We delete the data from the live service within 30 days of a verified request and from backups within a further 90 days, then confirm in writing. Deletion is permanent and cannot be undone.',
      'Before deletion — or at any time — the Company admin may ask us for an export of the Company\'s data in a commonly used, machine-readable format.',
      'We may still keep the limited records we are legally required to keep (for example invoices and payment records kept for tax and accounting purposes), and nothing else.',
    ],
  },
  {
    id: 'privacy',
    title: '11. Data protection and privacy',
    paragraphs: [
      'The Company owns the data it enters into FirmiCore. For personal data about its users and staff, the Company is the controller and Lumora Ventures is its processor under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018 (c. 12). We process that data only on the Company\'s instructions to provide, secure and support the service, and we do not sell it. Keeping data during a suspension (section 10) is done on the Company\'s behalf so that service can be resumed; the Company may instruct us to delete it at any time.',
      'We keep the data confidential, protect it with appropriate technical and organisational security measures, and use sub-processors only where needed to run the service: Google Firebase (hosting, database and storage) and Stripe (payments; card data is handled by Stripe under PCI-DSS). We will tell the Company without undue delay if we become aware of a personal data breach affecting its data, and we help the Company respond to requests from individuals (UK GDPR Articles 15 to 22), including erasure (Article 17) and data portability (Article 20).',
      'Where the Company or its users are in Sri Lanka, we also process personal data in line with the Personal Data Protection Act, No. 9 of 2022. Individuals may complain to the UK Information Commissioner\'s Office (ico.org.uk).',
    ],
  },
  {
    id: 'acceptable-use',
    title: '12. Acceptable use and our rights',
    paragraphs: [
      'The Company and its users must not: access or try to access another company\'s data or any part of FirmiCore without authorisation; attack, overload, probe or interfere with the service; introduce malware; copy, resell, reverse engineer or build a competing product from FirmiCore (except as permitted by section 50B of the Copyright, Designs and Patents Act 1988); use false identities or payment details, or make dishonest chargebacks; or use FirmiCore for anything unlawful.',
      'FirmiCore, its software, design and content are owned by Lumora Ventures and protected by the Copyright, Designs and Patents Act 1988 (c. 48) and other intellectual property laws. The Company receives a non-exclusive, non-transferable right to use FirmiCore during its subscription; no ownership passes to it.',
    ],
  },
  {
    id: 'breach',
    title: '13. What happens if these Terms are broken or we are harmed',
    paragraphs: [
      'If the Company or any of its users breaches these Terms, or acts in a way that harms Lumora Ventures, FirmiCore or other customers, we may immediately suspend or terminate the account, without refund of fees already paid. Suspension or termination for breach does not by itself delete the Company\'s data (section 10), unless deletion is needed to stop unlawful content or is required by law.',
      'The Company is responsible for, and will compensate us for, losses, damage, costs and reasonable legal fees we suffer because of the Company\'s or its users\' breach of these Terms, misuse of the service, or infringement of our rights. We may bring a claim for damages or an injunction in the courts.',
      'Some conduct is also a criminal offence, and we may report it to the police (including Action Fraud) and to the relevant regulators, and co-operate with any investigation. This includes unauthorised access to or interference with computer systems or data under the Computer Misuse Act 1990 (c. 18) — sections 1 (unauthorised access), 2 (access with intent to commit further offences) and 3 (unauthorised acts impairing a computer) — and fraud, such as using false payment details or obtaining the service dishonestly, under the Fraud Act 2006 (c. 35), sections 2 and 11. Where the conduct happens in Sri Lanka it may also be an offence under the Computer Crimes Act, No. 24 of 2007.',
    ],
  },
  {
    id: 'liability',
    title: '14. Service and liability',
    paragraphs: [
      'FirmiCore is a maintenance-management tool; it does not replace the Company\'s own safety procedures, statutory inspections or professional judgement. We provide the service with reasonable skill and care, but it is otherwise provided "as is", and we do not promise it will be uninterrupted or error-free.',
      'Nothing in these Terms limits liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot be limited by law (including under section 2(1) of the Unfair Contract Terms Act 1977 (c. 50)). Subject to that, our total liability for all claims under or in connection with these Terms is limited to the fees the Company paid in the 12 months before the claim, and we are not liable for loss of profit, revenue, business or goodwill, or for any indirect or consequential loss. The Company agrees these limits are reasonable for the purposes of that Act.',
    ],
  },
  {
    id: 'law',
    title: '15. General, governing law and contact',
    paragraphs: [
      'We may update these Terms. Material changes will be announced in the app or by email before they apply, and the Company may be asked to accept the new version. Continuing to use FirmiCore after the changes take effect means the Company accepts them.',
      'Only the Company and Lumora Ventures have rights under these Terms; the Contracts (Rights of Third Parties) Act 1999 (c. 31) does not apply. If any part of these Terms is found unenforceable, the rest remains in force. These Terms are made and may be stored electronically, in accordance with the Electronic Commerce (EC Directive) Regulations 2002; in Sri Lanka they are also valid under the Electronic Transactions Act, No. 19 of 2006.',
      'These Terms, and any dispute arising from them, are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction. This does not affect any mandatory rights the Company has under the law of its own country. Translations are provided for convenience; the English version prevails.',
      `Questions about these Terms, billing, data export or deletion: ${PROVIDER.email} · ${PROVIDER.name}, ${PROVIDER.registeredOffice}.`,
    ],
  },
];
