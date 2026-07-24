export interface ChartDatum {
  label: string;
  value: number;
}

const PALETTE = ['#1A56DB', '#10B981', '#00C2FF', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

export interface BarChartOptions {
  // When true, each bar is coloured on a green→amber→red scale according to how
  // large its value is relative to the largest bar, so higher counts stand out.
  colorByValue?: boolean;
}

// Maps a 0..1 ratio to a green (low) → amber (mid) → red (high) colour.
function heatColor(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const stops = [
    { at: 0, c: [16, 185, 129] }, // #10B981 green
    { at: 0.5, c: [245, 158, 11] }, // #F59E0B amber
    { at: 1, c: [239, 68, 68] }, // #EF4444 red
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (clamped >= stops[i].at && clamped <= stops[i + 1].at) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const span = upper.at - lower.at || 1;
  const t = (clamped - lower.at) / span;
  const rgb = lower.c.map((v, i) => Math.round(v + (upper.c[i] - v) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Renders a simple vertical bar chart onto an offscreen canvas and returns a
 * PNG data URL suitable for jsPDF.addImage. Dependency-free.
 */
export function renderBarChart(
  title: string,
  data: ChartDatum[],
  width = 900,
  height = 420,
  options: BarChartOptions = {},
): string | null {
  if (typeof document === 'undefined' || data.length === 0) return null;
  const canvas = document.createElement('canvas');
  // Render at 2x for crisp output in the PDF.
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);

  // Background.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Title.
  ctx.fillStyle = '#0A1628';
  ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(title, 24, 16);

  const padLeft = 56;
  const padRight = 24;
  const padTop = 64;
  const padBottom = 70;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const baseY = padTop + chartH;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Y axis gridlines + labels.
  ctx.strokeStyle = '#E5EAF0';
  ctx.fillStyle = '#64748B';
  ctx.font = '12px Helvetica, Arial, sans-serif';
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const y = baseY - (chartH * i) / ticks;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();
    const val = Math.round((maxValue * i) / ticks);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), padLeft - 8, y);
  }

  // Bars.
  const n = data.length;
  const slot = chartW / n;
  const barW = Math.min(slot * 0.6, 90);
  ctx.textAlign = 'center';
  data.forEach((d, i) => {
    const x = padLeft + slot * i + (slot - barW) / 2;
    const h = (d.value / maxValue) * chartH;
    const y = baseY - h;
    ctx.fillStyle = options.colorByValue ? heatColor(d.value / maxValue) : PALETTE[i % PALETTE.length];
    ctx.fillRect(x, y, barW, h);

    // Value label.
    ctx.fillStyle = '#0A1628';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(d.value), x + barW / 2, y - 3);

    // Category label (truncated).
    ctx.fillStyle = '#475569';
    ctx.font = '12px Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'top';
    const label = d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label;
    ctx.fillText(label, x + barW / 2, baseY + 8);
  });

  return canvas.toDataURL('image/png');
}
