/**
 * FirmiCore Terms of Service, including the subscription & billing terms that
 * every company admin accepts when registering, adding a card and starting a
 * paid plan. The legal text is kept in English (the governing version, see
 * §13) — only the surrounding UI is translated.
 *
 * Bump TERMS_VERSION whenever the text changes materially: each acceptance
 * is recorded with the version that was shown.
 */
export const TERMS_VERSION = '2026-09-27';
export const TERMS_EFFECTIVE_DATE = '27 September 2026';

export interface TermsSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'agreement',
    title: '1. Agreement',
    paragraphs: [
      'These Terms of Service ("Terms") are a binding agreement between Lumora Ventures, the provider of FirmiCore ("we", "us"), and the company or organisation that registers a FirmiCore account ("the Company", "you"). The person who registers the account or accepts these Terms on the Company\'s behalf confirms that they are authorised to bind the Company.',
      'By ticking "I agree", registering, adding a payment card or starting a paid plan, you accept these Terms. If you do not agree, do not use FirmiCore.',
    ],
  },
  {
    id: 'accounts',
    title: '2. Company account, users and roles',
    paragraphs: [
      'A FirmiCore account belongs to the Company, not to an individual. The Company admin may invite users and assign them roles (for example admin, plant manager, supervisor, technician, store keeper, HR officer, trainee, floor operator and safety officer).',
      'The Company is responsible for every user it invites, for keeping login details secure, and for all activity carried out under its account. Plan limits (such as the number of users, machines, inventory items, PM schedules and work orders) apply to the whole Company.',
    ],
  },
  {
    id: 'plans',
    title: '3. Plans and billing cycles',
    paragraphs: [
      'Paid plans are offered as separate Monthly and Yearly subscriptions. A Monthly subscription is billed every month; a Yearly subscription is billed once every 12 months at the yearly price shown when you subscribe. The two cycles are separate products: the price, the renewal date and the billing period differ, and choosing one does not include the other.',
      'Prices are shown in US dollars and exclude any taxes, bank or currency-conversion charges, which are the Company\'s responsibility. The plan limits and features that apply are those shown on the Billing & Plan page for the plan and cycle you subscribe to.',
    ],
  },
  {
    id: 'auto-renewal',
    title: '4. Automatic renewal and authorisation to charge',
    paragraphs: [
      'Subscriptions renew automatically. By subscribing, the Company authorises us, through our payment processor Stripe, to charge the default payment card on file the plan price at the start of each billing period — every month for a Monthly subscription, every year for a Yearly subscription — until the subscription is cancelled.',
      'One subscription covers the whole Company and all of its users and roles; individual users are not billed separately. Charges continue regardless of how many users log in or how much the service is used during a period.',
      'By adding a card you authorise Stripe to store it securely and to charge it for this subscription and for future renewals in accordance with these Terms. FirmiCore never receives or stores your full card number.',
    ],
  },
  {
    id: 'changes',
    title: '5. Upgrades, downgrades and switching cycles',
    paragraphs: [
      'The Company admin can change plan or switch between Monthly and Yearly billing from the Billing & Plan page. Changes take effect as shown at the time of the change; Stripe may prorate the difference, charge the difference immediately, or apply a credit to the next invoice.',
    ],
  },
  {
    id: 'failed-payments',
    title: '6. Failed payments',
    paragraphs: [
      'If a renewal charge fails, we (through Stripe) may retry the charge and notify the Company. If payment still cannot be collected, the subscription may be cancelled and access suspended as described in section 8.',
    ],
  },
  {
    id: 'cancellation',
    title: '7. Cancellation',
    paragraphs: [
      'The Company admin can cancel the subscription at any time from the Billing & Plan page (Manage subscription). Cancellation stops future renewals; it takes effect at the end of the billing period that has already been paid for.',
      'Fees already paid are non-refundable, including for unused time in a Monthly or Yearly period, except where a refund is required by applicable law.',
    ],
  },
  {
    id: 'suspension',
    title: '8. Loss of access when a subscription ends',
    paragraphs: [
      'When the paid period of a cancelled or unpaid subscription ends, access to FirmiCore is automatically suspended for every user and every role of the Company. Only the Company admin can still open the Billing & Plan page to start a new subscription.',
      'Suspension does not delete the Company\'s data. Records remain stored and become available again to all users as soon as a new subscription is active.',
    ],
  },
  {
    id: 'data',
    title: '9. Your data and privacy',
    paragraphs: [
      'The Company owns the data it enters into FirmiCore. We process it only to provide, secure and improve the service, and we do not sell it. Data is stored with Google Firebase; payments are processed by Stripe, which handles card data under PCI-DSS.',
      'Data of a suspended Company is retained so that service can be resumed. The Company admin may ask us in writing to export or permanently delete the Company\'s data; deletion cannot be undone.',
    ],
  },
  {
    id: 'acceptable-use',
    title: '10. Acceptable use',
    paragraphs: [
      'You must not misuse FirmiCore, attempt to access other companies\' data, interfere with the service, or use it for anything unlawful. We may suspend an account that breaches these Terms.',
    ],
  },
  {
    id: 'liability',
    title: '11. Service and liability',
    paragraphs: [
      'FirmiCore is a maintenance-management tool; it does not replace the Company\'s own safety procedures, statutory inspections or professional judgement. The service is provided "as is". To the extent permitted by law, our total liability for any claim is limited to the fees the Company paid in the 12 months before the claim, and we are not liable for indirect or consequential loss.',
    ],
  },
  {
    id: 'changes-to-terms',
    title: '12. Changes to these Terms',
    paragraphs: [
      'We may update these Terms. Material changes will be announced in the app or by email before they apply; the Company may be asked to accept the new version. Continuing to use FirmiCore after changes take effect means the Company accepts them.',
    ],
  },
  {
    id: 'law',
    title: '13. Governing law and contact',
    paragraphs: [
      'These Terms are governed by the laws of the Democratic Socialist Republic of Sri Lanka, without affecting any mandatory consumer rights in the Company\'s own country. Translations are provided for convenience; the English version prevails.',
      'Questions about these Terms or billing: info@lumoraventures.com.',
    ],
  },
];
