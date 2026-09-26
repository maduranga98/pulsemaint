import { jsPDF } from 'jspdf';
import {
  ACCENT, FOOTER_LABEL, INK, MUTED, NAVY,
  circle, diamondDivider, fillRect, fitSize, formatCertificateDate, hexMark, imageContain,
  polygon, registerCertificateFonts, richParagraph, seal, signatureBlock, spacedText,
  strokeRect, textWidth, truncate,
} from '@/lib/pdf/certificateDesign';
import type { ProgrammeDuration, ProgrammeDurationPreset, ProgrammeModuleResult } from '../../types/traineeProgram';
import { formatDurationLabel } from './programmeDuration';

export interface ProgrammeCertificateInput {
  certificateNumber: string;
  companyName: string;
  companyDescription?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyLogoDataUrl?: string | null;
  traineeName: string;
  traineeEmployeeId: string | null;
  durationMonths: ProgrammeDuration;
  durationPreset: ProgrammeDurationPreset;
  startDate: Date;
  completedDate: Date;
  moduleResults: ProgrammeModuleResult[];
  finalMark: number;
  recommendation: string;
  recommendedByName: string;
  recommendedByRole: string;
  /** PNG data URL of the authorizer's digital signature, if captured. */
  signatureImageDataUrl?: string | null;
}

const W = 794;
const CX = W / 2;

/**
 * Builds the Trainee Programme Certificate of Completion in the portrait
 * navy/sky-blue design (template "Recommended — A4 portrait"): angled header
 * band with the company's logo and name, the seal, the trainee's name in
 * script, duration / final mark / date awarded, the modules completed month
 * by month, the recommendation, the authorizer's captured digital signature,
 * and the certificate ID in the footer band. Every value comes from the
 * programme record — no placeholder copy.
 */
export async function buildProgrammeCertificatePdf(input: ProgrammeCertificateInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const c = await registerCertificateFonts(doc);

  strokeRect(c, 32, 32, W - 64, 1123 - 64, NAVY, 1.5);
  strokeRect(c, 41, 41, W - 82, 1123 - 82, ACCENT, 1);

  // Header and footer bands.
  polygon(c, [[0, 0], [794, 0], [794, 200], [0, 280]], NAVY);
  polygon(c, [[0, 252], [794, 172], [794, 180], [0, 260]], ACCENT);
  polygon(c, [[0, 0], [794, 0], [794, 160], [0, 240]], INK);
  polygon(c, [[520, 0], [560, 0], [290, 229], [250, 233]], NAVY, 0.55);
  polygon(c, [[600, 0], [612, 0], [350, 223], [338, 224]], ACCENT, 0.6);
  polygon(c, [[0, 943 + 56], [794, 943 + 6], [794, 943 + 12], [0, 943 + 62]], ACCENT);
  polygon(c, [[0, 943 + 70], [794, 943 + 20], [794, 1123], [0, 1123]], NAVY);
  polygon(c, [[0, 943 + 110], [794, 943 + 50], [794, 1123], [0, 1123]], INK);

  // Organisation (white on the dark band); the logo sits on a white badge so
  // dark logos stay visible.
  const orgStyle = { key: 'manropeBold' as const, size: 13, spacing: 4, color: '#FFFFFF' };
  const orgLabel = truncate(c, (input.companyName || 'FirmiCore').toUpperCase(), orgStyle, 520);
  const markSize = input.companyLogoDataUrl ? 38 : 30;
  const orgLeft = CX - (markSize + 12 + textWidth(c, orgLabel, orgStyle)) / 2;
  let drewLogo = false;
  if (input.companyLogoDataUrl) {
    circle(c, orgLeft + markSize / 2, 67, markSize / 2, '#FFFFFF');
    drewLogo = imageContain(c, input.companyLogoDataUrl, orgLeft + 6, 67 - markSize / 2 + 6, markSize - 12, markSize - 12);
  }
  if (!drewLogo) hexMark(c, orgLeft + (markSize - 30) / 2, 52, ACCENT, '#FFFFFF', true);
  spacedText(c, orgLabel, orgLeft + markSize + 12, 67, orgStyle, 'left');

  seal(c, 397, 240, true);

  spacedText(c, 'CERTIFICATE', CX, 364, { key: 'cinzel', size: 56, spacing: 8, color: INK });
  const subStyle = { key: 'manropeSemi' as const, size: 15, spacing: 6, color: NAVY };
  const subtitle = 'OF COMPLETION';
  const subW = textWidth(c, subtitle, subStyle);
  spacedText(c, subtitle, CX, 414, subStyle);
  fillRect(c, CX - subW / 2 - 16 - 56, 413, 56, 2, ACCENT);
  fillRect(c, CX + subW / 2 + 16, 413, 56, 2, ACCENT);

  spacedText(c, 'This certificate is proudly presented to', CX, 464, { key: 'cormorantItalic', size: 22, color: MUTED });
  const nameStyle = { key: 'pinyon' as const, size: 72, color: NAVY };
  spacedText(c, input.traineeName, CX, 514, { ...nameStyle, size: fitSize(c, input.traineeName, nameStyle, 600, 36) });
  diamondDivider(c, CX, 562, 220);

  let y = 600;
  if (input.traineeEmployeeId) {
    spacedText(c, `EMPLOYEE ID: ${input.traineeEmployeeId}`, CX, 579, { key: 'manropeSemi', size: 10.5, spacing: 2, color: MUTED });
    y = 606;
  }

  const durationLabel = formatDurationLabel(input.durationPreset, input.durationMonths);
  y = richParagraph(c, [
    { text: 'In recognition of outstanding performance, dedication and professional excellence in successfully completing the ', key: 'manrope', color: MUTED },
    { text: `${durationLabel} Trainee Training Programme`, key: 'manropeBold', color: INK },
    { text: `, from ${formatCertificateDate(input.startDate)} to ${formatCertificateDate(input.completedDate)}.`, key: 'manrope', color: MUTED },
  ], CX, y, 560, 15, 23, 3);

  // Recommendation, quoted — the programme's closing assessment.
  const recommendation = input.recommendation?.trim();
  if (recommendation) {
    y = richParagraph(c, [{ text: `“${recommendation}”`, key: 'cormorantItalic', color: MUTED }], CX, y + 12, 560, 15.5, 19, 2);
  }

  // Duration · Final mark · Date awarded.
  const gridTop = Math.max(676, y + 12);
  const cols: { left: number; color: string; label: string; value: string }[] = [
    { left: 88, color: ACCENT, label: 'DURATION', value: durationLabel },
    { left: 299.3, color: NAVY, label: 'FINAL MARK', value: `${input.finalMark}%` },
    { left: 510.6, color: INK, label: 'DATE AWARDED', value: formatCertificateDate(input.completedDate) },
  ];
  cols.forEach((col) => {
    fillRect(c, col.left, gridTop, 195.4, 3, col.color);
    spacedText(c, col.label, col.left + 97.7, gridTop + 22.5, { key: 'manropeSemi', size: 11, spacing: 2, color: MUTED });
    const valueStyle = { key: 'manropeBold' as const, size: 15, color: NAVY };
    spacedText(c, truncate(c, col.value, valueStyle, 190), col.left + 97.7, gridTop + 46.5, valueStyle);
  });

  // Modules completed, month by month, in up to three columns.
  const sigRule = 905;
  const modules = [...input.moduleResults].sort((a, b) => a.month - b.month);
  if (modules.length) {
    const headY = gridTop + 74;
    spacedText(c, 'MODULES COMPLETED', CX, headY, { key: 'manropeSemi', size: 10.5, spacing: 2, color: MUTED });
    const rowH = 14;
    // Rows stop clear of the captured signature drawn above the signature rule.
    const maxRows = Math.max(1, Math.floor((sigRule - 58 - (headY + 16)) / rowH) + 1);
    const colCount = modules.length <= maxRows ? 1 : modules.length <= maxRows * 2 ? 2 : 3;
    const colW = 618 / colCount;
    const capacity = maxRows * colCount;
    const shown = modules.length > capacity ? modules.slice(0, capacity - 1) : modules;
    const entries = shown.map((m) => `Month ${m.month} — ${m.moduleName}`);
    if (modules.length > capacity) entries.push(`+ ${modules.length - shown.length} more`);
    const rows = Math.ceil(entries.length / colCount);
    const itemStyle = { key: 'manrope' as const, size: 10.5, color: INK };
    entries.forEach((text, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const cellX = 88 + col * colW;
      const label = truncate(c, text, itemStyle, colW - 12);
      if (colCount === 1) {
        spacedText(c, label, CX, headY + 16 + row * rowH, itemStyle);
      } else {
        spacedText(c, label, cellX, headY + 16 + row * rowH, itemStyle, 'left');
      }
    });
  }

  // Signatures: the authorizer (with their captured signature) and the
  // issuing company.
  signatureBlock(c, 88, 240, sigRule, input.recommendedByName, input.recommendedByRole, input.signatureImageDataUrl);
  signatureBlock(c, 466, 240, sigRule, input.companyName || 'FirmiCore', 'Issuing Organisation');

  // Footer band: certificate ID and a verification contact.
  const labelStyle = { key: 'manropeSemi' as const, size: 11, spacing: 2, color: FOOTER_LABEL };
  const valueStyle = { key: 'manropeSemi' as const, size: 11, spacing: 2, color: '#FFFFFF' };
  const idW = spacedText(c, 'CERTIFICATE ID: ', 64, 1071.5, labelStyle, 'left');
  spacedText(c, input.certificateNumber, 64 + idW, 1071.5, valueStyle, 'left');

  const contact = (input.companyEmail || input.companyPhone || '').trim();
  const [rLabel, rValue] = contact
    ? ['VERIFY: ', truncate(c, contact, valueStyle, 260)]
    : ['ISSUED: ', formatCertificateDate(input.completedDate).toUpperCase()];
  const rValueW = textWidth(c, rValue, valueStyle);
  const rLabelW = textWidth(c, rLabel, labelStyle);
  spacedText(c, rLabel, 730 - rValueW - rLabelW, 1071.5, labelStyle, 'left');
  spacedText(c, rValue, 730 - rValueW, 1071.5, valueStyle, 'left');

  return doc;
}
