// ---------------------------------------------------------------------------
// Recharts light theme constants — for pages that use a white/light
// background instead of FirmiCore's default dark dashboard theme (see
// chartTheme.ts). Larger, higher-contrast text for readability.
// ---------------------------------------------------------------------------

export const CHART_COLORS_LIGHT = {
  primary: '#2563EB', // Blue 600
  secondary: '#0891B2', // Cyan 600
  success: '#16A34A', // Green 600
  warning: '#D97706', // Amber 600
  danger: '#DC2626', // Red 600
  muted: '#E2E8F0', // Slate 200 — grid lines
  text: '#94A3B8', // Slate 400 — axis labels, lighter while staying legible
  tooltip: '#FFFFFF',
} as const;

export const CHART_DEFAULTS_LIGHT = {
  cartesianGrid: {
    strokeDasharray: '3 3' as const,
    stroke: '#E2E8F0',
  },
  xAxis: {
    tick: { fill: '#94A3B8', fontSize: 12, fontFamily: 'DM Sans' },
    axisLine: { stroke: '#E2E8F0' },
    tickLine: false,
    tickMargin: 10,
  },
  yAxis: {
    tick: { fill: '#94A3B8', fontSize: 12, fontFamily: 'DM Sans' },
    axisLine: false,
    tickLine: false,
    tickMargin: 10,
  },
  tooltip: {
    // Recharts' default hover cursor is an opaque gray rect spanning the
    // full bar row, which reads as a stray UI glitch on a white card —
    // disable it everywhere; the bar's own hover state is feedback enough.
    cursor: false,
    contentStyle: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      fontFamily: 'DM Sans',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
    },
    labelStyle: { color: '#0F172A', fontWeight: 600 },
    itemStyle: { color: '#334155' },
  },
  legend: {
    wrapperStyle: { fontFamily: 'DM Sans', fontSize: 12, color: '#334155' },
  },
} as const;
