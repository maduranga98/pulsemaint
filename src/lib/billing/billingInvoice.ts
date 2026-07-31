import type { CompanyProfile, UserProfile } from '@/types/auth';
import { buildBillingInvoicePdf } from './billingInvoicePdf';

interface GenerateBillingInvoiceInput {
  company: CompanyProfile;
  billedBy: UserProfile;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  discountApplied: boolean;
  discountPercent: number;
}

/**
 * Builds a FirmiCore subscription invoice PDF for the company's current
 * plan/cycle and triggers a browser download. Generated entirely
 * client-side — not persisted.
 */
export async function generateBillingInvoice(input: GenerateBillingInvoiceInput): Promise<void> {
  const { company, billedBy, planName, billingCycle, amount, discountApplied, discountPercent } = input;

  const invoiceNumber = `PM-${company.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;
  const defaultCard = company.paymentMethods?.find((m) => m.isDefault);

  const pdf = buildBillingInvoicePdf({
    invoiceNumber,
    invoiceDate: new Date(),

    billedCompanyName: company.name,
    billedCompanyAddress: company.address,
    billedCompanyEmail: company.email,
    attentionName: billedBy.fullName,

    planName,
    billingCycle,
    amount,
    currency: company.currency || 'USD',
    discountApplied,
    discountPercent,

    paymentMethodLabel: defaultCard ? `${defaultCard.brand} •••• ${defaultCard.last4}` : null,
  });

  pdf.save(`FirmiCore-Invoice-${invoiceNumber}.pdf`);
}
