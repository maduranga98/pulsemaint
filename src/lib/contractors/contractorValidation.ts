import { z } from 'zod';
import {
  CONTRACTOR_DOCUMENT_TYPES,
  CONTRACTOR_JOB_STATUSES,
  CONTRACTOR_SPECIALIZATION_TAGS,
} from './contractorTypes';

const optionalNumber = z.coerce.number().min(0).optional().or(z.literal('').transform(() => undefined));
const optionalString = z.string().trim().optional();

export const contractorCompanySchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  tradeName: optionalString,
  registrationNumber: z.string().trim().min(2, 'Registration number is required'),
  companyType: z.enum(['sole_proprietor', 'partnership', 'private_ltd', 'public_ltd', 'foreign']),
  dateEstablished: z.string().regex(/^\d{4}$/, 'Use a 4-digit year').optional().or(z.literal('')),
  companySize: z.enum(['1_10', '11_50', '51_200', '200_plus']).optional(),
  primaryAddress: z.string().trim().min(4, 'Address is required'),
  city: z.string().trim().min(2, 'City is required'),
  district: optionalString,
  country: z.string().trim().min(2, 'Country is required'),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'blacklisted']),
  notes: optionalString,
});

export const contractorContactSchema = z.object({
  primaryContactName: z.string().trim().min(2, 'Primary contact is required'),
  primaryContactDesig: optionalString,
  primaryPhone: z.string().trim().min(5, 'Primary phone is required'),
  primaryEmail: z.string().email('Valid email is required'),
  secondaryContactName: optionalString,
  secondaryPhone: optionalString,
  secondaryEmail: z.string().email().optional().or(z.literal('')),
  emergencyContact: z.string().trim().min(5, 'Emergency contact is required'),
  whatsappNumber: optionalString,
  preferredContactMethod: z.enum(['phone', 'email', 'whatsapp']),
});

export const contractorCapabilitySchema = z.object({
  specializationTags: z.array(z.enum(CONTRACTOR_SPECIALIZATION_TAGS)).min(1, 'Choose at least one specialization'),
  machineTypesServiced: z.array(z.string()).default([]),
  industriesServed: z.array(z.string()).default([]),
  geographicCoverage: z.array(z.string()).default([]),
  serviceHours: z.enum(['24_7', 'business_hours', 'on_call', 'custom']),
  customServiceHours: optionalString,
  emergencyResponseTime: optionalString,
  teamSizeAvailable: optionalNumber,
  languagesSpoken: z.array(z.string()).default([]),
});

export const contractorFinancialSchema = z.object({
  paymentTerms: z.enum(['net_7', 'net_14', 'net_30', 'cash_on_delivery', 'advance_required']).optional(),
  currency: z.enum(['LKR', 'USD', 'SGD', 'other']).default('LKR'),
  standardLaborRate: optionalNumber,
  overtimeRate: optionalNumber,
  emergencyCallOutFee: optionalNumber,
  minimumCharge: optionalNumber,
  travelFee: optionalString,
  bankName: optionalString,
  bankBranch: optionalString,
  bankAccountNumber: optionalString,
  taxRegistrationNumber: optionalString,
  preferredInvoiceFormat: z.enum(['email_pdf', 'physical', 'pulsemaint_auto']).optional(),
});

export const contractorFormSchema = contractorCompanySchema
  .merge(contractorContactSchema)
  .merge(contractorCapabilitySchema)
  .merge(contractorFinancialSchema)
  .superRefine((value, ctx) => {
    if (value.status === 'blacklisted') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'Use the blacklist action so audit fields are captured.',
      });
    }
    if (value.serviceHours === 'custom' && !value.customServiceHours?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customServiceHours'],
        message: 'Custom service hours are required.',
      });
    }
  });

export const contractorDocumentSchema = z.object({
  documentType: z.enum(CONTRACTOR_DOCUMENT_TYPES),
  documentName: z.string().trim().min(2, 'Document name is required'),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isPermanent: z.boolean().default(false),
  notes: optionalString,
});

export const contractorTechnicianSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  nicOrPassport: z.string().trim().min(4, 'NIC or passport is required'),
  designation: z.enum(['engineer', 'senior_technician', 'technician', 'helper', 'other']),
  specialization: z.array(z.enum(CONTRACTOR_SPECIALIZATION_TAGS)).default([]),
  certifications: z.array(z.string()).default([]),
  phone: optionalString,
  email: z.string().email().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const contractorWorkStepSchema = z.object({
  description: z.string().trim().min(3, 'Describe the work performed'),
  durationMinutes: z.coerce.number().min(1, 'Duration is required'),
  photoUrls: z.array(z.string().url()).default([]),
});

export const contractorRatingSchema = z.object({
  speedScore: z.number().min(1).max(5),
  qualityScore: z.number().min(1).max(5),
  professionalismScore: z.number().min(1).max(5),
  communicationScore: z.number().min(1).max(5),
  notes: optionalString,
  followUpRequired: z.boolean().default(false),
  followUpReason: optionalString,
  followUpBreakdownId: optionalString,
});

export const contractorJobStatusSchema = z.enum(CONTRACTOR_JOB_STATUSES);

export type ContractorFormValues = z.infer<typeof contractorFormSchema>;
export type ContractorDocumentValues = z.infer<typeof contractorDocumentSchema>;
export type ContractorTechnicianValues = z.infer<typeof contractorTechnicianSchema>;
export type ContractorWorkStepValues = z.infer<typeof contractorWorkStepSchema>;
export type ContractorRatingValues = z.infer<typeof contractorRatingSchema>;
