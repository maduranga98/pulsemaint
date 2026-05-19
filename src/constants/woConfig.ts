import type { WOPriority, WOStatus, WOType } from '../types/workOrder';

// ---------------------------------------------------------------------------
// WO Type Configuration
// ---------------------------------------------------------------------------

export interface WOTypeConfig {
  label: string;
  code: WOType;
  icon: string;          // emoji icon
  color: string;         // hex accent color
  bgClass: string;       // Tailwind bg class
  textClass: string;     // Tailwind text class
  borderClass: string;   // Tailwind border class
  slaHours: Record<WOPriority, number>;
  requiresScheduledStart: boolean;
  requiresLinkedBreakdown: boolean;
}

export const WO_TYPE_CONFIG: Record<WOType, WOTypeConfig> = {
  BREAKDOWN: {
    label: 'Breakdown Repair',
    code: 'BREAKDOWN',
    icon: '🔴',
    color: '#EF4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
    borderClass: 'border-red-500',
    requiresScheduledStart: false,
    requiresLinkedBreakdown: true,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
  CORRECTIVE: {
    label: 'Corrective Maintenance',
    code: 'CORRECTIVE',
    icon: '🔧',
    color: '#F59E0B',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-500',
    requiresScheduledStart: false,
    requiresLinkedBreakdown: false,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
  PREVENTIVE: {
    label: 'Preventive Maintenance',
    code: 'PREVENTIVE',
    icon: '📅',
    color: '#1A56DB',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-500',
    requiresScheduledStart: true,
    requiresLinkedBreakdown: false,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
  INSTALLATION: {
    label: 'Installation',
    code: 'INSTALLATION',
    icon: '🏗️',
    color: '#8B5CF6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-800',
    borderClass: 'border-violet-500',
    requiresScheduledStart: true,
    requiresLinkedBreakdown: false,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
  MODIFICATION: {
    label: 'Modification / Upgrade',
    code: 'MODIFICATION',
    icon: '🔄',
    color: '#0EA5E9',
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-800',
    borderClass: 'border-sky-500',
    requiresScheduledStart: false,
    requiresLinkedBreakdown: false,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
  INSPECTION: {
    label: 'Inspection',
    code: 'INSPECTION',
    icon: '🔍',
    color: '#10B981',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-500',
    requiresScheduledStart: true,
    requiresLinkedBreakdown: false,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
  CONTRACTOR: {
    label: 'Contractor Job',
    code: 'CONTRACTOR',
    icon: '🤝',
    color: '#6366F1',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-800',
    borderClass: 'border-indigo-500',
    requiresScheduledStart: false,
    requiresLinkedBreakdown: false,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
  OTHER: {
    label: 'Other',
    code: 'OTHER',
    icon: '📋',
    color: '#6B7280',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    borderClass: 'border-gray-400',
    requiresScheduledStart: false,
    requiresLinkedBreakdown: false,
    slaHours: { critical: 2, high: 8, medium: 24, low: 72 },
  },
};

export const WO_TYPES_ORDERED: WOType[] = [
  'BREAKDOWN',
  'CORRECTIVE',
  'PREVENTIVE',
  'INSTALLATION',
  'MODIFICATION',
  'INSPECTION',
  'CONTRACTOR',
  'OTHER',
];

// ---------------------------------------------------------------------------
// Priority Configuration
// ---------------------------------------------------------------------------

export interface WOPriorityConfig {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  defaultSlaHours: number;
  smsSent: boolean;
}

export const WO_PRIORITY_CONFIG: Record<WOPriority, WOPriorityConfig> = {
  critical: {
    label: 'Critical',
    color: '#EF4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    borderClass: 'border-l-red-500',
    defaultSlaHours: 2,
    smsSent: true,
  },
  high: {
    label: 'High',
    color: '#F59E0B',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-l-amber-500',
    defaultSlaHours: 8,
    smsSent: false,
  },
  medium: {
    label: 'Medium',
    color: '#EAB308',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-700',
    borderClass: 'border-l-yellow-400',
    defaultSlaHours: 24,
    smsSent: false,
  },
  low: {
    label: 'Low',
    color: '#10B981',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
    borderClass: 'border-l-emerald-500',
    defaultSlaHours: 72,
    smsSent: false,
  },
};

// ---------------------------------------------------------------------------
// Status Configuration
// ---------------------------------------------------------------------------

export interface WOStatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  // Statuses that can be transitioned to from this status (by role — enforced server-side)
  terminalForTechnician: boolean;
}

export const WO_STATUS_CONFIG: Record<WOStatus, WOStatusConfig> = {
  DRAFT:            { label: 'Draft',                bgClass: 'bg-gray-100',    textClass: 'text-gray-600',    dotClass: 'bg-gray-400',    terminalForTechnician: true },
  OPEN:             { label: 'Open',                 bgClass: 'bg-blue-100',    textClass: 'text-blue-800',    dotClass: 'bg-blue-500',    terminalForTechnician: true },
  ASSIGNED:         { label: 'Assigned',             bgClass: 'bg-indigo-100',  textClass: 'text-indigo-800',  dotClass: 'bg-indigo-500',  terminalForTechnician: false },
  IN_PROGRESS:      { label: 'In Progress',          bgClass: 'bg-amber-100',   textClass: 'text-amber-800',   dotClass: 'bg-amber-500',   terminalForTechnician: false },
  ON_HOLD_PARTS:    { label: 'On Hold — Parts',      bgClass: 'bg-orange-100',  textClass: 'text-orange-800',  dotClass: 'bg-orange-500',  terminalForTechnician: false },
  ON_HOLD_APPROVAL: { label: 'On Hold — Approval',   bgClass: 'bg-red-100',     textClass: 'text-red-700',     dotClass: 'bg-red-400',     terminalForTechnician: false },
  COMPLETED:        { label: 'Completed',            bgClass: 'bg-emerald-100', textClass: 'text-emerald-800', dotClass: 'bg-emerald-500', terminalForTechnician: true },
  SIGNED_OFF:       { label: 'Signed Off',           bgClass: 'bg-green-100',   textClass: 'text-green-800',   dotClass: 'bg-green-500',   terminalForTechnician: true },
  CLOSED:           { label: 'Closed',               bgClass: 'bg-gray-100',    textClass: 'text-gray-500',    dotClass: 'bg-gray-300',    terminalForTechnician: true },
  CANCELLED:        { label: 'Cancelled',            bgClass: 'bg-red-50',      textClass: 'text-red-500',     dotClass: 'bg-red-300',     terminalForTechnician: true },
};

// Statuses shown as kanban columns (excludes CANCELLED)
export const KANBAN_STATUSES: WOStatus[] = [
  'DRAFT',
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD_PARTS',
  'ON_HOLD_APPROVAL',
  'COMPLETED',
  'SIGNED_OFF',
  'CLOSED',
];

// ---------------------------------------------------------------------------
// Root Cause Configuration
// ---------------------------------------------------------------------------

export const WO_ROOT_CAUSE_LABELS: Record<string, string> = {
  wear_and_tear:        'Wear & Tear',
  operator_error:       'Operator Error',
  manufacturing_defect: 'Manufacturing Defect',
  lack_of_maintenance:  'Lack of Maintenance',
  external_damage:      'External Damage',
  unknown:              'Unknown',
};

// ---------------------------------------------------------------------------
// SLA — derive from priority + wo type at creation
// ---------------------------------------------------------------------------

export function getSlaDeadline(createdAt: Date, priority: WOPriority, woType: WOType): Date {
  const slaHours = WO_TYPE_CONFIG[woType].slaHours[priority];
  return new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
}

// Warning threshold: 30 minutes before SLA (use this to avoid conflict with sla.ts)
export const WO_SLA_WARNING_BEFORE_MS = 30 * 60 * 1000;

// Statuses that stop SLA countdown
export const SLA_STOPPED_STATUSES: WOStatus[] = ['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'];
