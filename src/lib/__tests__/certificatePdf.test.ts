import { describe, it, expect } from 'vitest';
import { buildCertificateNumber, certificateFileName } from '../training/certificatePdf';

describe('certificateFileName', () => {
  it('builds a filesystem-safe name from the trainee and certificate number', () => {
    expect(certificateFileName('Asitha Perera', 'CERT-2026-AB12CD')).toBe(
      'Asitha_Perera_CERT-2026-AB12CD.pdf',
    );
  });

  it('strips punctuation rather than emitting it into a filename', () => {
    expect(certificateFileName("O'Brien, J.", 'CERT/2026/X')).toBe('O_Brien_J_CERT2026X.pdf');
  });

  it('falls back when the name or number is unusable', () => {
    expect(certificateFileName('***', '***')).toBe('certificate_cert.pdf');
  });
});

describe('buildCertificateNumber', () => {
  it('is prefixed and carries the issue year', () => {
    expect(buildCertificateNumber(new Date('2026-07-29T00:00:00Z'))).toMatch(/^CERT-2026-[A-Z0-9]{6}$/);
  });

  it('does not repeat across issues', () => {
    const numbers = new Set(Array.from({ length: 50 }, () => buildCertificateNumber()));
    expect(numbers.size).toBe(50);
  });
});
