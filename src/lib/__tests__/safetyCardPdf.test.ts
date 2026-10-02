import { describe, it, expect } from 'vitest';
import { buildSafetyCardPdf, packQualifications, safetyCardFileName, type Painter } from '../safety/safetyCardPdf';
import { cropToAspect } from '../safety/imageCrop';
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
  qualifications: ['NVQ Level 4 — Welding (MIG/TIG)', 'City & Guilds 2391 Inspection'],
  holderPhone: '',
  holderPhotoUrl: '',
  issuedAt: ts(Date.UTC(2026, 9, 2)),
  validUntil: ts(Date.UTC(2027, 9, 2)),
  issuedBy: 'u1',
  issuedByName: 'Safety Officer',
  signedOffByName: 'Dilani Fernando',
  signedOffByTitle: 'Safety Officer',
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

  it('still builds with very long names, many long qualifications and a missing contact person', async () => {
    const doc = await buildSafetyCardPdf({
      ...card,
      companyName: 'Acme Manufacturing International Holdings (Private) Limited',
      holderName: 'Wickramasinghe Mudiyanselage Kasun Bandara Herath Mudalige',
      contractorName: 'A very long contractor company name that will never fit on one line of a tiny card',
      contactPersonName: '',
      contactPersonPhone: '',
      holderField: '',
      qualifications: [
        'NVQ Level 4 — Welding (MIG/TIG/Stick) & Fabrication',
        'City & Guilds 2391 Inspection and Testing',
        'Confined Space Entry Supervisor',
        'IOSH Managing Safely',
        'Working at Height Rescue',
      ],
    });
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('builds a card issued before qualifications and signatures existed', async () => {
    const legacy = { ...card, signedOffByName: undefined, signedOffByTitle: undefined, signatureDataUrl: undefined } as Partial<ContractorSafetyCard>;
    delete legacy.qualifications;
    const doc = await buildSafetyCardPdf(legacy as ContractorSafetyCard);
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('builds when the logo or photo cannot be decoded (falls back to monogram and silhouette)', async () => {
    const doc = await buildSafetyCardPdf(card, { logoDataUrl: 'data:image/png;base64,AAAA', photoDataUrl: 'not-an-image' });
    expect(doc.getNumberOfPages()).toBe(2);
  });
});

// A fixed-width stand-in for the real font metrics: every character is 0.05" wide at any size.
const fakePainter: Painter = {
  width: (text) => [...text].length * 0.05,
  draw: (text) => [...text].length * 0.05,
};
const more = (n: number) => `+${n} more`;

describe('packQualifications', () => {
  it('puts everything on one line when it fits', () => {
    const { lines } = packQualifications(fakePainter, ['NVQ 4 Welding', 'IOSH'], 2, 2, [5.8], more);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('NVQ 4 Welding');
    expect(lines[0]).toContain('IOSH');
  });

  it('never splits one qualification across two lines', () => {
    const items = ['NVQ Level 4 Welding', 'City and Guilds 2391', 'Confined Space Entry'];
    const { lines } = packQualifications(fakePainter, items, 1.2, 3, [5.8], more);
    for (const item of items) {
      expect(lines.filter((l) => l.includes(item))).toHaveLength(1);
    }
  });

  it('counts what does not fit instead of dropping it silently', () => {
    const items = ['Alpha qualification', 'Bravo qualification', 'Charlie qualification', 'Delta qualification'];
    const { lines } = packQualifications(fakePainter, items, 2, 1, [5.8], more);
    expect(lines).toHaveLength(1);
    const shown = items.filter((i) => lines[0].includes(i)).length;
    const hidden = Number(/\+(\d+) more/.exec(lines[0])?.[1] ?? 0);
    expect(shown + hidden).toBe(items.length);
    expect(hidden).toBeGreaterThan(0);
  });

  it('truncates a single oversized qualification with an ellipsis and still reports the rest', () => {
    const items = ['An extremely long qualification title', 'Bravo', 'Charlie', 'Delta'];
    const { lines } = packQualifications(fakePainter, items, 1.1, 1, [5.8], more);
    expect(lines[0]).toContain('…');
    expect(lines[0]).toContain('+3 more');
  });

  it('shrinks the type to fit more before it resorts to "+N more"', () => {
    // Text gets narrower as the type size drops, like the real font.
    const shrinking: Painter = { width: (t, size) => [...t].length * 0.01 * size, draw: () => 0 };
    const items = ['Alpha qualification', 'Bravo qualification'];
    const { size, lines } = packQualifications(shrinking, items, 2.4, 1, [9, 5], more);
    expect(size).toBe(5);
    expect(lines[0]).not.toContain('more');
  });
});

describe('cropToAspect', () => {
  it('returns the image untouched where there is no canvas (server / tests)', async () => {
    expect(await cropToAspect('data:image/png;base64,AAAA', 0.8)).toBe('data:image/png;base64,AAAA');
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
