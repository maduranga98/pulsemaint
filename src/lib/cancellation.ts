/** Reasons a company cancels / leaves — keep in sync with CANCELLATION_REASONS in functions/src/billing/cancellations.js. */
export const CANCELLATION_REASONS = [
  'too_expensive', 'missing_features', 'not_using', 'switching', 'technical_issues', 'hard_to_use', 'business_closed', 'temporary', 'other',
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
export type CancellationKind = 'cancel_subscription' | 'leave_system';

/** English labels for the platform console (the company side uses i18n). */
export const CANCELLATION_REASON_LABEL: Record<string, string> = {
  too_expensive: 'Too expensive', missing_features: 'Missing features', not_using: "Doesn't use it enough",
  switching: 'Switching to another system', technical_issues: 'Bugs / technical problems', hard_to_use: 'Too hard to use',
  business_closed: 'Business closed or merged', temporary: 'Only needed temporarily', other: 'Other',
};
