import { jsPDF } from 'jspdf';
import {
  INK, MUTED, NAVY, PAPER, TEAL, WAVE_LIGHT, WAVE_SHADE,
  awardSeal, brandMark, checkItem, fillPath, fillRect, fitSize, footerBlock, formatCertificateDate,
  registerCertificateFonts, spacedText, textWidth, truncate, wrapLines,
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
const H = 1123;
const CX = W / 2;

/**
 * Builds the Trainee Programme Certificate of Completion in the A4 portrait
 * navy wave design: wave header with the company's mark and name, the
 * CERTIFICATE heading, the trainee's name in Playfair italic over a teal
 * rule, the programme (duration, dates, final mark), the modules completed
 * as a teal checklist, the recommender's recommendation, and a date · award
 * seal · signature footer with the authorizer's captured signature and the
 * certificate ID. Every value comes from the programme record — no
 * placeholder copy.
 */
export async function buildProgrammeCertificatePdf(input: ProgrammeCertificateInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const c = await registerCertificateFonts(doc);

  // Background waves, then the navy wave header.
  fillRect(c, 0, 0, W, H, PAPER);
  fillPath(c, [
    ['M', 0, 432], ['C', 200, 404, 400, 418, 560, 440], ['C', 680, 456, 740, 440, W, 402],
    ['L', W, 470], ['C', 700, 502, 600, 506, 450, 490], ['C', 300, 476, 150, 470, 0, 500],
  ], WAVE_LIGHT);
  fillPath(c, [
    ['M', 0, 742], ['C', 200, 720, 400, 730, 560, 745], ['C', 680, 757, 740, 745, W, 720],
    ['L', W, 768], ['C', 700, 790, 580, 796, 450, 782], ['C', 300, 770, 150, 772, 0, 800],
  ], WAVE_SHADE);
  fillPath(c, [
    ['M', 0, 962], ['C', 200, 940, 420, 946, 560, 956], ['C', 680, 964, 740, 950, W, 930],
    ['L', W, H], ['L', 0, H],
  ], '#FAFBFC');
  fillPath(c, [
    ['M', 0, 0], ['L', W, 0], ['L', W, 150], ['C', 700, 134, 620, 140, 520, 160],
    ['C', 400, 185, 250, 212, 110, 208], ['C', 60, 207, 25, 203, 0, 199],
  ], NAVY);

  // Organisation: mark + name on the header.
  const orgStyle = { key: 'bold' as const, size: 13.5, spacing: 4.3, color: '#FFFFFF' };
  const orgLabel = truncate(c, (input.companyName || 'FirmiCore').toUpperCase(), orgStyle, 560);
  const markSize = input.companyLogoDataUrl ? 36 : 28;
  const orgLeft = CX - (markSize + 14 + textWidth(c, orgLabel, orgStyle)) / 2;
  brandMark(c, orgLeft + markSize / 2, 65, markSize, input.companyLogoDataUrl);
  spacedText(c, orgLabel, orgLeft + markSize + 14, 65, orgStyle, 'left');

  spacedText(c, 'CERTIFICATE', CX, 300, { key: 'display', size: 60, spacing: 2.5, color: INK });
  spacedText(c, 'OF COMPLETION', CX, 347, { key: 'semi', size: 15.5, spacing: 8.5, color: NAVY });
  spacedText(c, 'PROUDLY PRESENTED TO', CX, 392, { key: 'medium', size: 12.4, spacing: 5.5, color: MUTED });

  const nameStyle = { key: 'script' as const, size: 54, color: NAVY };
  spacedText(c, input.traineeName, CX, 441, { ...nameStyle, size: fitSize(c, input.traineeName, nameStyle, 560, 30) });
  fillRect(c, 187, 481, 420, 1.8, TEAL);

  spacedText(c, 'HAS SUCCESSFULLY COMPLETED THE', CX, 511, { key: 'semi', size: 11.5, spacing: 5, color: MUTED });
  const durationLabel = formatDurationLabel(input.durationPreset, input.durationMonths);
  const titleStyle = { key: 'display' as const, size: 22, color: NAVY };
  const titleLines = wrapLines(c, `${durationLabel} Trainee Training Programme`.toUpperCase(), titleStyle, 600, 2);
  titleLines.forEach((line, i) => spacedText(c, line, CX, 539 + i * 27, titleStyle));
  let y = 539 + (titleLines.length - 1) * 27;

  const details = [
    `${formatCertificateDate(input.startDate)} – ${formatCertificateDate(input.completedDate)}`,
    `Final mark ${input.finalMark}%`,
    input.traineeEmployeeId ? `Employee ID ${input.traineeEmployeeId}` : '',
  ].filter(Boolean).join('   ·   ');
  const detailStyle = { key: 'medium' as const, size: 11, color: MUTED };
  spacedText(c, truncate(c, details, detailStyle, 640), CX, y + 25, detailStyle);
  y += 25;

  // The recommender's recommendation sits under the module checklist; it is
  // measured first so the checklist knows where it has to stop. Everything
  // must finish above the seal's gold ring (top ≈ 836px).
  const recStyle = { key: 'medium' as const, size: 11, color: INK };
  const recommendation = input.recommendation?.trim().replace(/\s+/g, ' ') ?? '';
  const recLines = recommendation ? wrapLines(c, `“${recommendation}”`, recStyle, 540, 4) : [];
  const recLineH = 16;
  const recBlockH = recLines.length ? 24 + recLines.length * recLineH : 0;
  const recTop = 824 - recBlockH;

  // Completed modules, month order, as the design's two-column checklist.
  const modules = [...input.moduleResults].sort((a, b) => a.month - b.month).map((m) => m.moduleName).filter(Boolean);
  let listEnd = y;
  if (modules.length) {
    const headY = y + 32;
    spacedText(c, 'COMPLETED MODULES', 137, headY, { key: 'bold', size: 10, spacing: 5, color: INK }, 'left');
    const limit = (recLines.length ? recTop - 22 : 822);
    const colCount = modules.length > 12 ? 3 : 2;
    const colX = colCount === 2 ? [137, 412] : [137, 317, 497];
    const colW = colCount === 2 ? 265 : 175;
    const firstRow = headY + 24;
    const rowH = Math.min(24, Math.max(17, (limit - firstRow) / Math.max(1, Math.ceil(modules.length / colCount) - 1)));
    const maxRows = Math.max(1, Math.floor((limit - firstRow) / rowH) + 1);
    const capacity = maxRows * colCount;
    const shown = modules.length > capacity ? [...modules.slice(0, capacity - 1), `+ ${modules.length - capacity + 1} more`] : modules;
    shown.forEach((label, i) => {
      checkItem(c, colX[i % colCount], firstRow + Math.floor(i / colCount) * rowH, label, colW, colCount === 2 ? 12.5 : 11);
    });
    listEnd = firstRow + (Math.ceil(shown.length / colCount) - 1) * rowH + 10;
  }

  if (recLines.length) {
    // Sit right under the checklist when it is short; never lower than recTop.
    const top = Math.min(recTop, Math.max(listEnd + 22, y + 32));
    spacedText(c, 'RECOMMENDATION', CX, top, { key: 'bold', size: 10, spacing: 5, color: INK });
    recLines.forEach((line, i) => spacedText(c, line, CX, top + 24 + i * recLineH, recStyle));
  }

  awardSeal(c, CX, 900, String(input.completedDate.getFullYear()));
  footerBlock(c, 185, 210, 970, formatCertificateDate(input.completedDate), 'Date');
  footerBlock(c, 609, 210, 970, input.recommendedByName, input.recommendedByRole || 'Signature', input.signatureImageDataUrl);

  // Certificate ID along the foot of the page.
  const labelStyle = { key: 'bold' as const, size: 9.5, spacing: 3.5, color: TEAL };
  const idStyle = { key: 'bold' as const, size: 11, spacing: 1, color: INK };
  const label = 'CERTIFICATE ID   ';
  const total = textWidth(c, label, labelStyle) + textWidth(c, input.certificateNumber, idStyle);
  const left = CX - total / 2;
  const lw = spacedText(c, label, left, 1082, labelStyle, 'left');
  spacedText(c, input.certificateNumber, left + lw, 1082, idStyle, 'left');

  return doc;
}
