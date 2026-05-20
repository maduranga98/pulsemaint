import type { Timestamp } from 'firebase/firestore';

export const CONTRACTOR_SPECIALIZATION_TAGS = [
  'electrical',
  'mechanical',
  'hydraulic',
  'pneumatic',
  'welding',
  'plc_automation',
  'hvac',
  'civil',
  'oem_authorized',
  'calibration',
  'inspection',
  'pressure_vessel',
  'elevator',
  'fire_safety',
  'other',
] as const;

export const CONTRACTOR_DOCUMENT_TYPES = [
  'business_registration',
  'company_profile',
  'insurance_certificate',
  'workmen_compensation',
  'iso_certification',
  'oem_authorization',
  'trade_license',
  'safety_certificate',
  'nda',
  'service_agreement',
  'bank_guarantee',
  'work_references',
  'tax_clearance',
  'other',
] as const;

export const CONTRACTOR_JOB_STATUSES = [
  'invitation_sent',
  'acknowledged',
  'contractor_arrived',
  'work_in_progress',
  'checklist_complete',
  'signed_off',
  'invoice_submitted',
  'payment_processed',
  'cancelled',
] as const;

export type ContractorSpecializationTag = (typeof CONTRACTOR_SPECIALIZATION_TAGS)[number];
export type ContractorDocumentType = (typeof CONTRACTOR_DOCUMENT_TYPES)[number];
export type ContractorJobStatus = (typeof CONTRACTOR_JOB_STATUSES)[number];
export type ContractorStatus = 'active' | 'inactive' | 'blacklisted';
export type ContractorCompanyType = 'sole_proprietor' | 'partnership' | 'private_ltd' | 'public_ltd' | 'foreign';
export type ContractorCompanySize = '1_10' | '11_50' | '51_200' | '200_plus';
export type PreferredContactMethod = 'phone' | 'email' | 'whatsapp';
export type ServiceHours = '24_7' | 'business_hours' | 'on_call' | 'custom';
export type PaymentTerms = 'net_7' | 'net_14' | 'net_30' | 'cash_on_delivery' | 'advance_required';
export type ContractorCurrency = 'LKR' | 'USD' | 'SGD' | 'other';
export type InvoiceFormat = 'email_pdf' | 'physical' | 'pulsemaint_auto';
export type DocumentValidityStatus = 'valid' | 'expiring_soon' | 'expired';
export type TechnicianDesignation = 'engineer' | 'senior_technician' | 'technician' | 'helper' | 'other';
export type TechnicianStatus = 'active' | 'inactive';
export type InvoiceStatus = 'pending' | 'approved' | 'disputed' | 'paid';
export type TestRunResult = 'pass' | 'fail' | 'partial';
export type MachineStatusAfter = 'operational' | 'partially_operational' | 'still_down';

export interface Contractor {
  id: string;
  companyId: string;
  companyName: string;
  tradeName?: string;
  registrationNumber: string;
  companyType: ContractorCompanyType;
  dateEstablished?: string;
  companySize?: ContractorCompanySize;
  primaryAddress: string;
  city: string;
  district?: string;
  country: string;
  website?: string;
  status: ContractorStatus;
  blacklistReason?: string;
  blacklistedAt?: Timestamp | null;
  blacklistedBy?: string;
  primaryContactName: string;
  primaryContactDesig?: string;
  primaryPhone: string;
  primaryEmail: string;
  secondaryContactName?: string;
  secondaryPhone?: string;
  secondaryEmail?: string;
  emergencyContact: string;
  whatsappNumber?: string;
  preferredContactMethod: PreferredContactMethod;
  specializationTags: ContractorSpecializationTag[];
  machineTypesServiced: string[];
  industriesServed: string[];
  geographicCoverage: string[];
  serviceHours: ServiceHours;
  customServiceHours?: string;
  emergencyResponseTime?: string;
  teamSizeAvailable?: number;
  languagesSpoken: string[];
  paymentTerms?: PaymentTerms;
  currency?: ContractorCurrency;
  standardLaborRate?: number;
  overtimeRate?: number;
  emergencyCallOutFee?: number;
  minimumCharge?: number;
  travelFee?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  taxRegistrationNumber?: string;
  preferredInvoiceFormat?: InvoiceFormat;
  totalJobsCount: number;
  breakdownJobsCount: number;
  pmJobsCount: number;
  installationJobsCount: number;
  avgRating: number;
  ratingCount: number;
  avgMttr: number;
  firstFixRate: number;
  slaComplianceRate: number;
  avgJobCost: number;
  avgResponseTime: number;
  invoiceAccuracyRate: number;
  repeatBreakdownRate: number;
  lastJobDate?: Timestamp | null;
  lastJobId?: string;
  blocksAssignment?: boolean;
  addedBy: string;
  addedByName: string;
  addedAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;
  notes?: string;
}

export interface ContractorDocument {
  id: string;
  contractorId: string;
  companyId: string;
  documentType: ContractorDocumentType;
  documentName: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  issueDate?: Timestamp | null;
  expiryDate?: Timestamp | null;
  isPermanent: boolean;
  hasExpiry: boolean;
  validityStatus: DocumentValidityStatus;
  daysUntilExpiry?: number | null;
  isCriticalDocument: boolean;
  blocksAssignment: boolean;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
  notes?: string;
  version: number;
  supersededBy?: string | null;
  lastExpiryNotificationKey?: string | null;
}

export interface ContractorTechnician {
  id: string;
  contractorId: string;
  companyId: string;
  contractorName: string;
  fullName: string;
  nicOrPassport: string;
  photoUrl?: string;
  designation: TechnicianDesignation;
  specialization: ContractorSpecializationTag[];
  certifications: string[];
  phone?: string;
  email?: string;
  status: TechnicianStatus;
  jobsAtThisFactory: number;
  lastVisitedAt?: Timestamp | null;
  lastVisitedJobId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ContractorWorkStep {
  id: string;
  stepNumber: number;
  description: string;
  loggedAt: Timestamp;
  loggedBy: string;
  loggedByName?: string;
  photoUrls: string[];
  durationMinutes: number;
  pendingSync?: boolean;
}

export interface ContractorPartFromFactory {
  partId: string;
  partNumber: string;
  partName: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  issuedBy: string;
}

export interface ContractorMaterial {
  description: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  notes?: string;
}

export interface ContractorRating {
  speedScore: number;
  qualityScore: number;
  professionalismScore: number;
  communicationScore: number;
  overallScore: number;
  notes?: string;
  ratedBy: string;
  ratedByName: string;
  ratedAt: Timestamp;
}

export interface ContractorJob {
  id: string;
  companyId: string;
  workOrderId: string;
  workOrderNumber: string;
  workOrderType: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | string;
  slaDeadline?: Timestamp | null;
  machineId: string;
  machineName: string;
  machineType?: string;
  machineLocation: string;
  machineCriticality?: number;
  breakdownTicketId?: string | null;
  breakdownDescription?: string;
  breakdownSeverity?: string;
  contractorId?: string;
  contractorName: string;
  contractorType?: string;
  isManuallyEntered: boolean;
  manualContractorName?: string;
  contactPerson: string;
  contactPhone: string;
  technicianNames: string[];
  technicianIds: string[];
  expectedArrivalTime?: Timestamp | null;
  status: ContractorJobStatus;
  invitationSentAt?: Timestamp | null;
  invitationAcknowledgedAt?: Timestamp | null;
  arrivedAt?: Timestamp | null;
  arrivedLoggedBy?: string;
  workStartedAt?: Timestamp | null;
  workCompletedAt?: Timestamp | null;
  departedAt?: Timestamp | null;
  onSiteDurationMinutes?: number;
  actualWorkDurationMinutes?: number;
  workSteps: ContractorWorkStep[];
  workDoneDescription?: string;
  rootCause?: string;
  partsFromFactory: ContractorPartFromFactory[];
  partsFromContractor: ContractorMaterial[];
  totalPartsFactoryCost: number;
  totalPartsCost: number;
  checklistResults: Array<{ step: string; passed: boolean; notes?: string }>;
  testRunResult?: TestRunResult;
  testRunNotes?: string;
  machineStatusAfter?: MachineStatusAfter;
  photoUrls: string[];
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  documentUrls: Array<{ name: string; url: string; type: string }>;
  signedOffBy?: string;
  signedOffByName?: string;
  signedOffAt?: Timestamp | null;
  signOffNotes?: string;
  signOffSignature?: string;
  isDisputed?: boolean;
  disputeNotes?: string;
  contractorInvoiceAmount?: number;
  contractorInvoiceRef?: string;
  contractorInvoiceDate?: Timestamp | null;
  contractorInvoiceUrl?: string;
  systemInvoiceAmount?: number;
  systemLaborHours?: number;
  systemLaborRate?: number;
  systemLaborCost?: number;
  systemPartsCost?: number;
  invoiceVarianceAmount?: number;
  invoiceVariancePercent?: number;
  invoiceVarianceFlagged?: boolean;
  invoiceStatus?: InvoiceStatus;
  rating?: ContractorRating;
  followUpRequired?: boolean;
  followUpReason?: string;
  followUpBreakdownId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ContractorInvitation {
  id: string;
  companyId: string;
  contractorJobId: string;
  contractorId?: string;
  contractorName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  whatsappNumber?: string;
  sentVia: Array<'email' | 'whatsapp'>;
  sentAt: Timestamp;
  sentBy: string;
  jobDetails: {
    workOrderNumber: string;
    machineName: string;
    machineLocation: string;
    jobType: string;
    description: string;
    slaDeadline?: Timestamp | null;
    priority: string;
    attachedDocUrls: string[];
  };
  emailDelivered: boolean;
  whatsappDelivered: boolean;
  resendCount: number;
  lastResentAt?: Timestamp | null;
}

export interface ContractorFilters {
  search?: string;
  specializationTags?: ContractorSpecializationTag[];
  status?: ContractorStatus | 'all';
  minRating?: number;
  documentStatus?: 'all' | 'valid' | 'expiring' | 'expired';
}

export const DOCUMENT_TYPE_LABELS: Record<ContractorDocumentType, string> = {
  business_registration: 'Business Registration',
  company_profile: 'Company Profile',
  insurance_certificate: 'Insurance Certificate',
  workmen_compensation: 'Workmen Compensation',
  iso_certification: 'ISO Certification',
  oem_authorization: 'OEM Authorization',
  trade_license: 'Trade License',
  safety_certificate: 'Safety Certificate',
  nda: 'NDA',
  service_agreement: 'Service Agreement',
  bank_guarantee: 'Bank Guarantee',
  work_references: 'Work References',
  tax_clearance: 'Tax Clearance',
  other: 'Other',
};

export const SPECIALIZATION_LABELS: Record<ContractorSpecializationTag, string> = {
  electrical: 'Electrical',
  mechanical: 'Mechanical',
  hydraulic: 'Hydraulic',
  pneumatic: 'Pneumatic',
  welding: 'Welding',
  plc_automation: 'PLC/Automation',
  hvac: 'HVAC',
  civil: 'Civil',
  oem_authorized: 'OEM Authorized',
  calibration: 'Calibration',
  inspection: 'Inspection',
  pressure_vessel: 'Pressure Vessel',
  elevator: 'Elevator',
  fire_safety: 'Fire Safety',
  other: 'Other',
};
