import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildTrainingCertificatePdf } from '../training/certificatePdf';
import { buildProgramCertificatePdf } from '../training/programCertificatePdf';
import { buildProgrammeCertificatePdf } from '../traineeProgram/programmeCertificatePdf';

// Font files can't be fetched here (no dev server) — the certificates must
// still generate, falling back to jsPDF's built-in fonts.
describe('certificate layouts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('build single-page PDFs even when the design fonts are unavailable', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false }));

    const training = await buildTrainingCertificatePdf({
      certificateNumber: 'CERT-2026-ABC123', traineeName: 'Nimal Perera', moduleName: 'Hydraulic Press Safety',
      subjectLabel: 'Machine', subjectValue: 'HP-200', quizScore: 92, issuedAt: new Date('2026-09-20'),
      issuedByName: 'Kasun Fernando', companyName: 'Acme',
    });
    const program = await buildProgramCertificatePdf({
      certificateNumber: 'PCERT-2026-ABC123', companyName: 'Acme', traineeName: 'Tharushi Jayasinghe',
      programName: 'CNC Fundamentals', issuedAt: new Date('2026-09-18'),
      moduleResults: [{ moduleId: '1', moduleName: 'CNC Basics', score: 88 }],
      signedOffByName: 'Kasun Fernando', signedOffByRole: 'plant_manager',
    });
    const programme = await buildProgrammeCertificatePdf({
      certificateNumber: 'TRN-CERT-2026-0007', companyName: 'Acme', traineeName: 'Sahan Wickramasinghe',
      traineeEmployeeId: 'EMP-1042', durationMonths: 12, durationPreset: 12,
      startDate: new Date('2025-09-01'), completedDate: new Date('2026-09-01'),
      moduleResults: Array.from({ length: 12 }, (_, i) => ({ moduleId: String(i), month: i + 1, score: 80, moduleName: `Module ${i + 1}` })),
      finalMark: 86, recommendation: 'Recommended for appointment.', recommendedByName: 'Dilani Senanayake',
      recommendedByRole: 'Plant Manager',
    });

    expect(training.internal.pageSize.getWidth()).toBeGreaterThan(training.internal.pageSize.getHeight());
    expect(program.internal.pageSize.getWidth()).toBeGreaterThan(program.internal.pageSize.getHeight());
    // Trainee Programme certificates are portrait and stay on one page even with 12 modules.
    expect(programme.internal.pageSize.getHeight()).toBeGreaterThan(programme.internal.pageSize.getWidth());
    expect(programme.getNumberOfPages()).toBe(1);
  });
});
