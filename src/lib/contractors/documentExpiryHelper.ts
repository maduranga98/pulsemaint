import type {
  ContractorDocument,
  ContractorDocumentType,
  DocumentValidityStatus,
} from './contractorTypes';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const CRITICAL_DOCUMENT_TYPES: ContractorDocumentType[] = [
  'insurance_certificate',
  'workmen_compensation',
  'trade_license',
  'safety_certificate',
];

export function isCriticalDocumentType(documentType: ContractorDocumentType): boolean {
  return CRITICAL_DOCUMENT_TYPES.includes(documentType);
}

export function timestampToDate(value: { toDate: () => Date } | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return value.toDate();
}

export function calculateDaysUntilExpiry(expiryDate: Date, now = new Date()): number {
  const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((expiryMidnight.getTime() - nowMidnight.getTime()) / MS_PER_DAY);
}

export function getValidityStatus(daysUntilExpiry: number | null, isPermanent: boolean): DocumentValidityStatus {
  if (isPermanent || daysUntilExpiry === null) return 'valid';
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'valid';
}

export function deriveDocumentExpiry(
  expiryDate: Date | null,
  isPermanent: boolean,
  documentType: ContractorDocumentType,
  now = new Date(),
) {
  const daysUntilExpiry = expiryDate && !isPermanent ? calculateDaysUntilExpiry(expiryDate, now) : null;
  const validityStatus = getValidityStatus(daysUntilExpiry, isPermanent);
  const isCriticalDocument = isCriticalDocumentType(documentType);
  const blocksAssignment = isCriticalDocument && validityStatus === 'expired';

  return {
    hasExpiry: !isPermanent,
    daysUntilExpiry,
    validityStatus,
    isCriticalDocument,
    blocksAssignment,
  };
}

export function getContractorDocumentStatus(documents: ContractorDocument[]) {
  const activeDocuments = documents.filter((doc) => !doc.supersededBy);
  const hasExpired = activeDocuments.some((doc) => doc.validityStatus === 'expired');
  const hasExpiring = activeDocuments.some((doc) => doc.validityStatus === 'expiring_soon');
  const blocksAssignment = activeDocuments.some((doc) => doc.blocksAssignment);

  if (hasExpired || blocksAssignment) {
    return { status: 'expired' as const, label: 'Expired documents', blocksAssignment };
  }
  if (hasExpiring) {
    return { status: 'expiring' as const, label: 'Expiring soon', blocksAssignment: false };
  }
  return { status: 'valid' as const, label: 'Documents valid', blocksAssignment: false };
}

export function formatExpiryText(document: Pick<ContractorDocument, 'isPermanent' | 'daysUntilExpiry' | 'validityStatus'>): string {
  if (document.isPermanent) return 'No expiry';
  const days = document.daysUntilExpiry;
  if (days === null || days === undefined) return 'Expiry not set';
  if (document.validityStatus === 'expired') return `Expired ${Math.abs(days)} days ago`;
  if (document.validityStatus === 'expiring_soon') return `Expiring in ${days} days`;
  return `${days} days remaining`;
}
