import type { PMType, PMStatus, RecurrenceType } from '../types/pm.types';

// ---------------------------------------------------------------------------
// PM Type Configuration
// ---------------------------------------------------------------------------

export interface PMTypeConfig {
  label: string;
  icon: string;
  color: string;
  bgClass: string;
  textClass: string;
}

export const PM_TYPE_CONFIG: Record<PMType, PMTypeConfig> = {
  lubrication:       { label: 'Lubrication',       icon: '🛢️', color: '#1A56DB', bgClass: 'bg-blue-100',    textClass: 'text-blue-800' },
  inspection:        { label: 'Inspection',        icon: '🔍', color: '#10B981', bgClass: 'bg-emerald-100', textClass: 'text-emerald-800' },
  calibration:       { label: 'Calibration',       icon: '⚖️', color: '#8B5CF6', bgClass: 'bg-violet-100',  textClass: 'text-violet-800' },
  filter_replacement:{ label: 'Filter Replacement',icon: '🔄', color: '#0EA5E9', bgClass: 'bg-sky-100',     textClass: 'text-sky-800' },
  belt_chain_check:  { label: 'Belt/Chain Check',  icon: '⛓️', color: '#F59E0B', bgClass: 'bg-amber-100',   textClass: 'text-amber-800' },
  full_service:      { label: 'Full Service',      icon: '🔧', color: '#6366F1', bgClass: 'bg-indigo-100',  textClass: 'text-indigo-800' },
  electrical_check:  { label: 'Electrical Check',  icon: '⚡', color: '#EAB308', bgClass: 'bg-yellow-100',  textClass: 'text-yellow-800' },
  hydraulic_service: { label: 'Hydraulic Service', icon: '💧', color: '#06B6D4', bgClass: 'bg-cyan-100',    textClass: 'text-cyan-800' },
  safety_inspection: { label: 'Safety Inspection', icon: '🛡️', color: '#EF4444', bgClass: 'bg-red-100',     textClass: 'text-red-800' },
  other:             { label: 'Other',             icon: '📋', color: '#6B7280', bgClass: 'bg-gray-100',    textClass: 'text-gray-700' },
};

export const PM_TYPES_ORDERED: PMType[] = [
  'lubrication',
  'inspection',
  'calibration',
  'filter_replacement',
  'belt_chain_check',
  'full_service',
  'electrical_check',
  'hydraulic_service',
  'safety_inspection',
  'other',
];

// ---------------------------------------------------------------------------
// Recurrence Type Labels
// ---------------------------------------------------------------------------

export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  daily:       'Daily',
  weekly:      'Weekly',
  biweekly:    'Bi-weekly',
  monthly:     'Monthly',
  quarterly:   'Quarterly',
  semi_annual: 'Semi-Annual',
  annual:      'Annual',
  custom:      'Custom',
};

// ---------------------------------------------------------------------------
// PM Status Configuration
// ---------------------------------------------------------------------------

export interface PMStatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  icon?: string;
}

export const PM_STATUS_CONFIG: Record<PMStatus, PMStatusConfig> = {
  active:    { label: 'Active',    bgClass: 'bg-emerald-100', textClass: 'text-emerald-800', dotClass: 'bg-emerald-500', icon: '▶️' },
  paused:    { label: 'Paused',    bgClass: 'bg-gray-100',    textClass: 'text-gray-600',    dotClass: 'bg-gray-400',    icon: '⏸️' },
  completed: { label: 'Completed', bgClass: 'bg-blue-100',    textClass: 'text-blue-800',    dotClass: 'bg-blue-500',    icon: '✅' },
  archived:  { label: 'Archived',  bgClass: 'bg-slate-100',   textClass: 'text-slate-600',   dotClass: 'bg-slate-400',   icon: '📦' },
};

// ---------------------------------------------------------------------------
// PM Priority Configuration
// ---------------------------------------------------------------------------

export interface PMPriorityConfig {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const PM_PRIORITY_CONFIG: Record<'critical' | 'high' | 'medium' | 'low', PMPriorityConfig> = {
  critical: { label: 'Critical', color: '#EF4444', bgClass: 'bg-red-100',     textClass: 'text-red-700',     borderClass: 'border-l-red-500' },
  high:     { label: 'High',     color: '#F59E0B', bgClass: 'bg-amber-100',   textClass: 'text-amber-700',   borderClass: 'border-l-amber-500' },
  medium:   { label: 'Medium',   color: '#EAB308', bgClass: 'bg-yellow-100',  textClass: 'text-yellow-700',  borderClass: 'border-l-yellow-400' },
  low:      { label: 'Low',      color: '#10B981', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700', borderClass: 'border-l-emerald-500' },
};

// ---------------------------------------------------------------------------
// Operational Status (computed from schedule + nextDueDate)
// ---------------------------------------------------------------------------

export type PMOperationalStatus = 'on_track' | 'due_soon' | 'overdue' | 'paused';

export interface PMOperationalStatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  icon: string;
}

export const PM_OPERATIONAL_STATUS_CONFIG: Record<PMOperationalStatus, PMOperationalStatusConfig> = {
  on_track:  { label: 'On Track',  bgClass: 'bg-emerald-100', textClass: 'text-emerald-800', dotClass: 'bg-emerald-500', icon: '🟢' },
  due_soon:  { label: 'Due Soon',  bgClass: 'bg-amber-100',   textClass: 'text-amber-800',   dotClass: 'bg-amber-500',   icon: '🟡' },
  overdue:   { label: 'Overdue',   bgClass: 'bg-red-100',     textClass: 'text-red-800',     dotClass: 'bg-red-500',     icon: '🔴' },
  paused:    { label: 'Paused',    bgClass: 'bg-gray-100',    textClass: 'text-gray-600',    dotClass: 'bg-gray-400',    icon: '⏸️' },
};

// ---------------------------------------------------------------------------
// PM History Status Configuration
// ---------------------------------------------------------------------------

export const PM_HISTORY_STATUS_LABELS: Record<string, string> = {
  completed_on_time: 'Completed On Time',
  completed_late:    'Completed Late',
  overdue:           'Overdue',
  missed:            'Missed',
  in_progress:       'In Progress',
};

// ---------------------------------------------------------------------------
// Skills options
// ---------------------------------------------------------------------------

export const PM_SKILLS_OPTIONS = [
  'Electrical',
  'Mechanical',
  'Hydraulic',
  'Pneumatic',
  'Welding',
  'PLC',
  'HVAC',
  'Other',
] as const;

// ---------------------------------------------------------------------------
// Trigger unit labels
// ---------------------------------------------------------------------------

export const TRIGGER_UNIT_LABELS: Record<string, string> = {
  operating_hours: 'Operating Hours',
  production_cycles: 'Production Cycles',
};

// ---------------------------------------------------------------------------
// Compliance thresholds
// ---------------------------------------------------------------------------

export const COMPLIANCE_THRESHOLDS = {
  excellent: 90,
  good: 70,
  poor: 0,
} as const;

// Days before due to show "due soon"
export const PM_DUE_SOON_DAYS = 7;
