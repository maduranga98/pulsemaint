import { jsPDF } from 'jspdf';
import {
  ACCENT, INK, MUTED, NAVY,
  clipped, diamondDivider, fillRect, fitSize, hexMark, imageContain, polygon,
  registerCertificateFonts, richParagraph, seal, signatureBlock, spacedText,
  strokeRect, textWidth, truncate,
  type CertificateCanvas, type TextRun,
} from './certificateDesign';

/**
 * Content for the Classic A4-landscape certificate (template "Classic"):
 * double navy/sky border, angled corner bands, CERTIFICATE title, script
 * recipient name, and a date · seal · signature footer. Every field comes
 * from the certificate record — nothing here is placeholder copy.
 */
export interface ClassicCertificateContent {
  companyName: string;
  companyLogoDataUrl?: string | null;
  /** Line under CERTIFICATE, e.g. "OF TRAINING". */
  subtitle: string;
  recipientName: string;
  /** Small line under the name divider — designation / employee ID. */
  recipientCaption?: string | null;
  /** Main citation, mixed weights (course/programme name in bold). */
  citation: TextRun[];
  /** Up to two short supporting lines under the citation (machine, score, validity…). */
  detailLines?: string[];
  dateValue: string;
  dateLabel: string;
  signatoryName: string;
  signatoryCaption: string;
  signatureImageDataUrl?: string | null;
  certificateNumber: string;
}

const W = 1123;
const H = 794;
const CX = W / 2;

// Corner band, authored in a 460×320 viewBox squeezed into a 320×222 box.
const CORNER_SX = 320 / 460;
const CORNER_SY = 222 / 320;
const CORNER_BANDS: { pts: [number, number][]; color: string }[] = [
  { pts: [[490, 0], [500, 0], [40, 320], [26, 320]], color: ACCENT },
  { pts: [[0, 0], [460, 0], [0, 320]], color: NAVY },
  { pts: [[385, 0], [405, 0], [0, 282], [0, 268]], color: ACCENT },
  { pts: [[0, 0], [330, 0], [0, 230]], color: INK },
];

function drawCorners(c: CertificateCanvas): void {
  clipped(c, 0, 0, 320, 222, () => {
    CORNER_BANDS.forEach(({ pts, color }) =>
      polygon(c, pts.map(([x, y]) => [x * CORNER_SX, y * CORNER_SY]), color));
  });
  // Bottom-right is the same artwork rotated 180°.
  clipped(c, W - 320, H - 222, 320, 222, () => {
    CORNER_BANDS.forEach(({ pts, color }) =>
      polygon(c, pts.map(([x, y]) => [W - x * CORNER_SX, H - y * CORNER_SY]), color));
  });
}

function drawOrganisation(c: CertificateCanvas, name: string, logo?: string | null): void {
  const style = { key: 'manropeBold' as const, size: 13, spacing: 4, color: NAVY };
  const label = truncate(c, name.toUpperCase(), style, 560);
  const markSize = logo ? 36 : 30;
  const total = markSize + 12 + textWidth(c, label, style);
  const left = CX - total / 2;
  const cy = 107;
  const drewLogo = logo ? imageContain(c, logo, left, cy - markSize / 2, markSize, markSize) : false;
  if (!drewLogo) hexMark(c, left + (markSize - 30) / 2, cy - 15, NAVY, ACCENT);
  spacedText(c, label, left + markSize + 12, cy, style, 'left');
}

export async function buildClassicCertificatePdf(content: ClassicCertificateContent): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const c = await registerCertificateFonts(doc);

  strokeRect(c, 40, 40, W - 80, H - 80, NAVY, 1.5);
  strokeRect(c, 50, 50, W - 100, H - 100, ACCENT, 1);
  drawCorners(c);

  drawOrganisation(c, content.companyName || 'FirmiCore', content.companyLogoDataUrl);

  spacedText(c, 'CERTIFICATE', CX, 177.5, { key: 'cinzel', size: 68, spacing: 10, color: INK });

  const subStyle = { key: 'manropeSemi' as const, size: 15, spacing: 6, color: NAVY };
  const subW = textWidth(c, content.subtitle, subStyle);
  spacedText(c, content.subtitle, CX, 236.5, subStyle);
  fillRect(c, CX - subW / 2 - 16 - 64, 235.5, 64, 2, ACCENT);
  fillRect(c, CX + subW / 2 + 16, 235.5, 64, 2, ACCENT);

  spacedText(c, 'This certificate is proudly presented to', CX, 293.5, { key: 'cormorantItalic', size: 21, color: MUTED });

  const nameStyle = { key: 'pinyon' as const, size: 76, color: NAVY };
  const nameSize = fitSize(c, content.recipientName, nameStyle, 680, 40);
  spacedText(c, content.recipientName, CX, 350, { ...nameStyle, size: nameSize });
  diamondDivider(c, CX, 400.9, 250);

  let y = 436.9;
  if (content.recipientCaption?.trim()) {
    spacedText(c, truncate(c, content.recipientCaption.trim().toUpperCase(), { key: 'manropeSemi', size: 11, spacing: 2, color: MUTED }, 520),
      CX, 420, { key: 'manropeSemi', size: 11, spacing: 2, color: MUTED });
    y = 448;
  }

  y = richParagraph(c, content.citation, CX, y, 620, 15, 24.75, 3);

  (content.detailLines ?? []).filter(Boolean).slice(0, 2).forEach((line) => {
    y += 12;
    const style = { key: 'manrope' as const, size: 12.5, color: MUTED };
    spacedText(c, truncate(c, line, style, 680), CX, y, style);
    y += 8;
  });

  // Footer: date · seal · signature.
  fillRect(c, 200, 649, 210, 1, INK);
  spacedText(c, content.dateValue, 305, 669.5, { key: 'manropeBold', size: 14, color: INK });
  spacedText(c, content.dateLabel.toUpperCase(), 305, 690.5, { key: 'manropeSemi', size: 11, spacing: 2, color: MUTED });

  seal(c, 562, 638);

  signatureBlock(c, 713, 210, 649, content.signatoryName, content.signatoryCaption, content.signatureImageDataUrl);

  const numLabel = 'CERTIFICATE NO. ';
  const labelStyle = { key: 'manropeSemi' as const, size: 9.5, spacing: 2, color: MUTED };
  const numStyle = { key: 'manropeBold' as const, size: 9.5, spacing: 1, color: INK };
  const total = textWidth(c, numLabel, labelStyle) + textWidth(c, content.certificateNumber, numStyle);
  const left = CX - total / 2;
  const lw = spacedText(c, numLabel, left, 722, labelStyle, 'left');
  spacedText(c, content.certificateNumber, left + lw, 722, numStyle, 'left');

  return doc;
}
