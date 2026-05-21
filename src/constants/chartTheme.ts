// ---------------------------------------------------------------------------
// Recharts dark theme constants for PulseMaint dashboards
// ---------------------------------------------------------------------------

export const CHART_COLORS = {
  primary: '#1A56DB', // Power Blue
  secondary: '#00C2FF', // Pulse Cyan
  success: '#10B981', // Uptime Green
  warning: '#F59E0B', // Warning Amber
  danger: '#EF4444', // Critical Red
  muted: '#1E3A5F', // Border — grid lines
  text: '#8BA3BF', // Text Secondary — axis labels
  tooltip: '#0F1E35', // Surface — tooltip background
  breakdown_types: ['#1A56DB', '#00C2FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
} as const;

export const CHART_DEFAULTS = {
  cartesianGrid: {
    strokeDasharray: '3 3' as const,
    stroke: '#1E3A5F',
  },
  xAxis: {
    tick: { fill: '#8BA3BF', fontSize: 11, fontFamily: 'DM Sans' },
    axisLine: { stroke: '#1E3A5F' },
    tickLine: false,
  },
  yAxis: {
    tick: { fill: '#8BA3BF', fontSize: 11, fontFamily: 'DM Sans' },
    axisLine: false,
    tickLine: false,
  },
  tooltip: {
    contentStyle: {
      backgroundColor: '#0F1E35',
      border: '1px solid #1E3A5F',
      borderRadius: '8px',
      fontFamily: 'DM Sans',
    },
    labelStyle: { color: '#F0F4F8' },
    itemStyle: { color: '#F0F4F8' },
  },
  legend: {
    wrapperStyle: { fontFamily: 'DM Sans', fontSize: 12, color: '#8BA3BF' },
  },
} as const;

// ---------------------------------------------------------------------------
// Heatmap color scale
// ---------------------------------------------------------------------------

export function heatmapColor(intensity: number): string {
  // 0 = Deep Navy, 0.5 = Power Blue, 1.0 = Critical Red
  if (intensity <= 0) return '#0A1628';
  if (intensity <= 0.5) {
    // Interpolate between Deep Navy and Power Blue
    const t = intensity * 2;
    return interpolateColor('#0A1628', '#1A56DB', t);
  }
  // Interpolate between Power Blue and Critical Red
  const t = (intensity - 0.5) * 2;
  return interpolateColor('#1A56DB', '#EF4444', t);
}

function interpolateColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);
  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;
  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr}, ${rg}, ${rb})`;
}
