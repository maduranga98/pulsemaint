import { jsPDF } from 'jspdf';
import {
  INK, LIGHT_TEAL, MUTED, NAVY, PAPER, TEAL, WAVE_LIGHT, WAVE_SHADE,
  awardSeal, brandMark, checkItem, fillPath, fillRect, fitSize, footerBlock,
  registerCertificateFonts, spacedText, textWidth, truncate, wrapLines,
} from './certificateDesign';

/**
 * Content for the A4-landscape training certificate: curved navy side panel
 * (company mark, name and certificate ID), CERTIFICATE heading, the trainee's
 * name in Playfair italic over a teal rule, what they completed, a teal
 * checklist, and a date · award seal · signature footer. Every field comes
 * from the certificate record — nothing here is placeholder copy.
 */
export interface LandscapeCertificateContent {
  companyName: string;
  companyLogoDataUrl?: string | null;
  /** Line under CERTIFICATE, e.g. "OF TRAINING". */
  subtitle: string;
  recipientName: string;
  /** Small line under the name rule — e.g. designation. */
  recipientCaption?: string | null;
  /** e.g. "HAS SUCCESSFULLY COMPLETED THE TRAINING MODULE". */
  completedLine: string;
  /** Module / program name, shown in bold capitals. */
  title: string;
  listHeading: string;
  listItems: string[];
  dateValue: string;
  dateLabel: string;
  signatoryName: string;
  signatoryCaption: string;
  signatureImageDataUrl?: string | null;
  certificateNumber: string;
  /** Year shown on the award seal. */
  awardYear: string;
}

const W = 1123;
const H = 794;
const CX = 706;

function drawBackground(c: Awaited<ReturnType<typeof registerCertificateFonts>>): void {
  fillRect(c, 0, 0, W, H, PAPER);
  fillPath(c, [
    ['M', 260, 332], ['C', 420, 300, 560, 314, 700, 334], ['C', 850, 356, 980, 330, W, 286],
    ['L', W, 346], ['C', 980, 392, 850, 402, 700, 388], ['C', 560, 374, 420, 362, 260, 378],
  ], WAVE_LIGHT);
  fillPath(c, [
    ['M', 260, 608], ['C', 420, 584, 560, 590, 700, 604], ['C', 850, 620, 980, 610, W, 578],
    ['L', W, 626], ['C', 980, 656, 850, 662, 700, 650], ['C', 560, 640, 420, 634, 260, 648],
  ], WAVE_SHADE);
  fillPath(c, [
    ['M', 260, 704], ['C', 450, 692, 600, 700, 750, 712], ['C', 900, 724, 1020, 708, W, 692],
    ['L', W, H], ['L', 260, H],
  ], '#FAFBFC');
  // Curved navy side panel.
  fillPath(c, [
    ['M', 0, 0], ['L', 250, 0], ['C', 268, 60, 268, 300, 250, 420], ['C', 236, 520, 258, 620, 282, 700],
    ['C', 292, 740, 286, 780, 281, H], ['L', 0, H],
  ], NAVY);
}

export async function buildLandscapeCertificatePdf(content: LandscapeCertificateContent): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const c = await registerCertificateFonts(doc);
  drawBackground(c);

  // Side panel: brand mark, company name, certificate ID.
  brandMark(c, 64, 76, 42, content.companyLogoDataUrl);
  const orgStyle = { key: 'bold' as const, size: 12.4, spacing: 3.5, color: '#FFFFFF' };
  wrapLines(c, (content.companyName || 'FirmiCore').toUpperCase(), orgStyle, 190, 3)
    .forEach((line, i) => spacedText(c, line, 44, 122 + i * 19, orgStyle, 'left'));
  spacedText(c, 'CERTIFICATE ID', 44, 711, { key: 'bold', size: 10, spacing: 3.5, color: LIGHT_TEAL }, 'left');
  const idStyle = { key: 'bold' as const, size: 13.5, color: '#FFFFFF' };
  spacedText(c, truncate(c, content.certificateNumber, idStyle, 215), 44, 730, idStyle, 'left');

  spacedText(c, 'CERTIFICATE', CX, 87, { key: 'display', size: 58, spacing: 1.5, color: INK });
  spacedText(c, content.subtitle, CX, 134, { key: 'semi', size: 15.5, spacing: 8.5, color: NAVY });
  spacedText(c, 'PROUDLY PRESENTED TO', CX, 179, { key: 'medium', size: 12.4, spacing: 5.5, color: MUTED });

  const nameStyle = { key: 'script' as const, size: 56, color: NAVY };
  spacedText(c, content.recipientName, CX, 226, { ...nameStyle, size: fitSize(c, content.recipientName, nameStyle, 520, 30) });
  fillRect(c, 497, 263, 420, 1.8, TEAL);

  let y = 294;
  if (content.recipientCaption?.trim()) {
    const capStyle = { key: 'semi' as const, size: 9.5, spacing: 2.5, color: MUTED };
    spacedText(c, truncate(c, content.recipientCaption.trim().toUpperCase(), capStyle, 420), CX, 281, capStyle);
    y = 309;
  }
  spacedText(c, content.completedLine, CX, y, { key: 'semi', size: 11.5, spacing: 5, color: MUTED });

  const titleStyle = { key: 'display' as const, size: 22, color: NAVY };
  const titleLines = wrapLines(c, content.title.toUpperCase(), titleStyle, 600, 2);
  titleLines.forEach((line, i) => spacedText(c, line, CX, y + 27 + i * 27, titleStyle));
  y += 27 + (titleLines.length - 1) * 27;

  const items = content.listItems.filter(Boolean);
  if (items.length) {
    const headY = y + 39;
    spacedText(c, content.listHeading, 396, headY, { key: 'bold', size: 10, spacing: 5, color: INK }, 'left');
    // Three columns, filled row by row as in the design; two when the labels
    // are too long to read at a third of the width. Rows stop above the seal.
    const itemStyle = { key: 'medium' as const, size: 13, color: INK };
    const fitsThree = items.every((label) => textWidth(c, label, itemStyle) <= 184);
    const cols = fitsThree ? [396, 611, 825] : [396, 716];
    const colW = fitsThree ? 212 : 310;
    const rowH = 26.5;
    const maxRows = Math.max(1, Math.floor((560 - (headY + 27)) / rowH) + 1);
    const capacity = maxRows * cols.length;
    const shown = items.length > capacity ? [...items.slice(0, capacity - 1), `+ ${items.length - capacity + 1} more`] : items;
    shown.forEach((label, i) => {
      checkItem(c, cols[i % cols.length], headY + 27 + Math.floor(i / cols.length) * rowH, label, colW);
    });
  }

  awardSeal(c, CX, 640, content.awardYear, 0.89);
  footerBlock(c, 480, 200, 702, content.dateValue, content.dateLabel);
  footerBlock(c, 933, 200, 702, content.signatoryName, content.signatoryCaption, content.signatureImageDataUrl);

  return doc;
}
