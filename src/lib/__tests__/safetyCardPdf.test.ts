import { describe, it, expect } from 'vitest';
import { buildSafetyCardPdf, safetyCardFileName } from '../safety/safetyCardPdf';
import type { ContractorSafetyCard } from '../safety/contractorSafety';

const ts = (ms: number) => ({ toDate: () => new Date(ms), toMillis: () => ms }) as never;

const card: ContractorSafetyCard = {
  id: 'AbCdEfGhIjKlMnOpQrSt',
  companyId: 'co1',
  plantId: 'p1',
  companyName: 'Acme Manufacturing (Pvt) Ltd',
  plantName: 'Plant 2 — Biyagama',
  cardNumber: 'SC-2026-ABCDEF',
  inviteId: 'inv1',
  moduleId: 'm1',
  moduleTitle: 'Working at height & hot work',
  score: 92,
  contractorId: 'c1',
  contractorName: 'Lanka Electrical & Mechanical Services',
  contactPersonName: 'Nimal Perera',
  contactPersonDesignation: 'Operations Manager',
  contactPersonPhone: '+94 77 123 4567',
  technicianId: 't1',
  holderName: 'Kasun Bandara Wickramasinghe',
  holderNic: '199012345678',
  holderPosition: 'Senior Technician',
  holderField: 'Electrical, HVAC, PLC/Automation',
  holderPhone: '',
  holderPhotoUrl: '',
  issuedAt: ts(Date.UTC(2026, 9, 2)),
  validUntil: ts(Date.UTC(2027, 9, 2)),
  issuedBy: 'u1',
  issuedByName: 'Safety Officer',
  status: 'active',
};

describe('buildSafetyCardPdf', () => {
  it('is a two-page (front/back) card of 3.5 × 2 inches', async () => {
    const doc = await buildSafetyCardPdf(card, { qrUrl: 'https://app.example.com/safety-card?id=AbCdEfGhIjKlMnOpQrSt' });
    expect(doc.getNumberOfPages()).toBe(2);
    for (const page of [1, 2]) {
      const size = doc.getPageInfo(page).pageContext.mediaBox;
      expect((size.topRightX - size.bottomLeftX) / 72).toBeCloseTo(3.5, 2);
      expect((size.topRightY - size.bottomLeftY) / 72).toBeCloseTo(2, 2);
    }
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });

  it('still builds with very long names and a missing contact person', async () => {
    const doc = await buildSafetyCardPdf({
      ...card,
      holderName: 'Wickramasinghe Mudiyanselage Kasun Bandara Herath Mudalige',
      contractorName: 'A very long contractor company name that will never fit on one line of a tiny card',
      contactPersonName: '',
      contactPersonPhone: '',
      holderField: '',
    });
    expect(doc.getNumberOfPages()).toBe(2);
  });
});

describe('safetyCardFileName', () => {
  it('is filesystem safe', () => {
    expect(safetyCardFileName({ holderName: "Kasun O'Brien", cardNumber: 'SC-2026-ABCDEF' })).toBe(
      'safety-card_Kasun_O_Brien_SC-2026-ABCDEF.pdf',
    );
    expect(safetyCardFileName({ holderName: '***', cardNumber: '' })).toBe('safety-card_holder_card.pdf');
  });
});
