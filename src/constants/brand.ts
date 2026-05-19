// PulseMaint — Brand color tokens
// Single source of truth. Use these in Tailwind arbitrary values or inline styles.

export const BRAND_COLORS = {
  deepNavy: '#0A1628',
  powerBlue: '#1A56DB',
  pulseCyan: '#00C2FF',
  uptimeGreen: '#10B981',
  warningAmber: '#F59E0B',
  criticalRed: '#EF4444',
} as const;

// Severity → hex color mapping
export const SEVERITY_COLORS = {
  critical: BRAND_COLORS.criticalRed,
  high: BRAND_COLORS.warningAmber,
  medium: '#EAB308',   // yellow-500
  low: BRAND_COLORS.uptimeGreen,
} as const;

// Status → Tailwind bg + text class pairs
export const STATUS_BADGE_CLASSES: Record<string, { bg: string; text: string; dot: string }> = {
  reported:           { bg: 'bg-blue-100',      text: 'text-blue-800',    dot: 'bg-blue-500' },
  acknowledged:       { bg: 'bg-indigo-100',    text: 'text-indigo-800',  dot: 'bg-indigo-500' },
  triage_in_progress: { bg: 'bg-purple-100',    text: 'text-purple-800',  dot: 'bg-purple-500' },
  assigned:           { bg: 'bg-orange-100',    text: 'text-orange-800',  dot: 'bg-orange-500' },
  en_route:           { bg: 'bg-cyan-100',      text: 'text-cyan-800',    dot: 'bg-cyan-500' },
  repair_in_progress: { bg: 'bg-amber-100',     text: 'text-amber-800',   dot: 'bg-amber-500' },
  on_hold_parts:      { bg: 'bg-red-50',        text: 'text-red-600',     dot: 'bg-red-300' },
  on_hold_approval:   { bg: 'bg-red-100',       text: 'text-red-800',     dot: 'bg-red-500' },
  resolved:           { bg: 'bg-emerald-100',   text: 'text-emerald-800', dot: 'bg-emerald-500' },
  closed:             { bg: 'bg-gray-100',      text: 'text-gray-600',    dot: 'bg-gray-400' },
};

// Severity → Tailwind left-border color (kanban card accent)
export const SEVERITY_BORDER_CLASSES: Record<string, string> = {
  critical: 'border-l-red-500',
  high:     'border-l-amber-500',
  medium:   'border-l-yellow-400',
  low:      'border-l-emerald-500',
};

// Machine health → color (factory floor map)
export const MACHINE_HEALTH_COLORS = {
  operational: BRAND_COLORS.uptimeGreen,
  minorIssue:  BRAND_COLORS.warningAmber,
  critical:    BRAND_COLORS.criticalRed,
} as const;

// MTTR clock color thresholds (milliseconds)
export const MTTR_CLOCK_THRESHOLDS = {
  amberMs: 60 * 60 * 1000,        // 1 hour → amber
} as const;
