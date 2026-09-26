import { describe, it, expect, vi } from 'vitest';
import type { Timestamp } from 'firebase/firestore';

const saved: string[] = [];
const outputs: string[] = [];
vi.mock('jspdf', async (orig) => {
  const mod = await orig<typeof import('jspdf')>();
  // jsPDF attaches `save` per instance, so replace it after construction.
  class TestPDF extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      (this as unknown as { save: (n: string) => void }).save = (n: string) => {
        saved.push(n);
        outputs.push(this.output());
      };
    }
  }
  return { ...mod, jsPDF: TestPDF };
});
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ company: { name: 'Acme Ltd' } }) } }));
vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: {}, functions: {} }));
vi.mock('../../utils/reports/pdf/pdfFonts', () => ({ registerUnicodeFont: async () => 'helvetica' }));

let permitsForWo: unknown[] = [];
let rcaDocs: Record<string, unknown>[] = [];
vi.mock('@/services/safety.service', () => ({ listWorkPermitsForWorkOrder: async () => permitsForWo }));
vi.mock('firebase/firestore', async (orig) => {
  const mod = await orig<typeof import('firebase/firestore')>();
  return {
    ...mod,
    collection: () => ({}),
    query: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    limit: () => ({}),
    getDocs: async () => ({ empty: rcaDocs.length === 0, docs: rcaDocs.map((d, i) => ({ id: `r${i}`, data: () => d })) }),
  };
});

const { exportWorkOrderPdf, exportBreakdownPdf } = await import('../../utils/reports/pdf/maintenanceRecordPdf');

const ts = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => new Date(iso).getTime() }) as unknown as Timestamp;

describe('maintenance record PDFs', () => {
  it('exports a signed-off work order with full details', async () => {
    await exportWorkOrderPdf({
      id: 'w1', woNumber: 'WO-2026-0001', siteId: 's', woType: 'CORRECTIVE', priority: 'high', status: 'SIGNED_OFF',
      description: 'Replace bearing', machineName: 'Press 4', machineDepartment: 'Stamping', machineLocation: 'Bay 2',
      machineType: 'Press', machineCriticality: 4, supervisorInChargeName: 'Sam', assignedTechnicianNames: ['Ann', 'Bo'],
      checklist: [{ stepNumber: 1, stepDescription: 'Isolate', isCompleted: true, completedByName: 'Ann', completedAt: ts('2026-09-01T10:00:00Z'), result: 'pass', actualValue: null, unit: null, assignedTechnicianNames: ['Ann'] }],
      partsUsed: [{ partId: 'p', partName: 'Bearing', quantity: 2, unit: 'pcs', source: 'stock', unitCost: 10, totalCost: 20, warrantyMonths: 6 }],
      technicianWorkLogs: [{ technicianId: 'a', technicianName: 'Ann', hoursWorked: 2, tasksDescription: 'Fitted bearing' }],
      postRepairChecklist: [], statusHistory: [{ status: 'SIGNED_OFF', changedBy: 'x', changedByName: 'Sam', changedAt: ts('2026-09-01T12:00:00Z'), note: null }],
      supervisorSignOffByName: 'Sam', supervisorSignOffAt: ts('2026-09-01T12:00:00Z'), signOffOutcome: 'complete',
      aiRca: { source: 'ai', summary: 'Worn bearing', rootCause: 'Wear', rootCauseCategory: 'wear_and_tear', contributingFactors: ['Age'], evidence: [], preventiveActions: ['Lubricate'], confidence: 'high' },
      createdAt: ts('2026-08-30T08:00:00Z'), finalPhotos: [], documents: [],
    } as never);
    expect(saved.pop()).toBe('WO-2026-0001.pdf');
  });

  it('exports a closed breakdown', async () => {
    await exportBreakdownPdf({
      id: 'b1', ticketNumber: 'BD-0042', status: 'closed', machineName: 'Lathe', machineDepartment: 'Machining',
      reportedAt: ts('2026-09-02T08:00:00Z'), closedAt: ts('2026-09-02T11:30:00Z'), severity: 'high', type: 'mechanical',
      description: 'Spindle noise', statusHistory: [], photos: [], resolutionPhotos: [], assignedTechnicianNames: [],
    } as never, { linkedWoNumber: 'WO-2026-0002' });
    expect(saved.pop()).toBe('BD-0042.pdf');
  });

  it('prints linked work permits, the RCA author, and leaves out empty fields', async () => {
    permitsForWo = [
      {
        id: 'p1', permitNumber: 'PTW-2026-0001', title: 'Hot work on booth', category: 'hot_work', status: 'closed',
        source: 'work_order', requestedByName: 'Jammy', createdAt: ts('2026-09-24T15:23:00Z'),
        validFrom: '2026-09-24T20:53', validTo: '2026-09-26T18:00', originalValidTo: '2026-09-25T18:00',
        extensions: [{ from: '2026-09-25T18:00', to: '2026-09-26T18:00', at: ts('2026-09-25T10:00:00Z'), by: 'u', byName: 'Sam' }],
        closedAt: ts('2026-09-26T09:00:00Z'), signedOffByName: 'Sam', completion: 'completed', completionNote: '',
        precautions: ['Fire watch'], hazards: '', ppeRequired: '',
      },
      {
        id: 'p2', permitNumber: 'PTW-2026-0002', title: 'Electrical isolation', category: 'electrical_isolation',
        status: 'active', source: 'manual', requestedByName: 'Pat', createdAt: ts('2026-09-25T08:00:00Z'),
        validFrom: '2026-09-25T08:00', validTo: '2026-09-25T17:00', precautions: [],
      },
    ];
    rcaDocs = [{ createdByName: 'Asitha', createdAt: ts('2026-09-25T09:00:00Z'), problem: 'Paint leak', rootCause: 'Worn seal',
      whys: [{ question: 'Why did the problem occur?', answer: 'Seal failed' }, { question: 'Why did that happen?', answer: '' }], status: 'completed' }];

    await exportWorkOrderPdf({
      id: 'w3', companyId: 'c1', woNumber: 'WO-2026-0003', woType: 'BREAKDOWN', priority: 'medium', status: 'CLOSED',
      description: 'Leak', machineName: 'Paint Booth 03', machineType: '', requiresWorkPermit: true, ptwCategory: 'hot_work',
      workPermitId: 'p1', rootCause: 'wear_and_tear', rootCauseDescription: 'Seal worn',
      contractorCompanyName: null, contractorTechnicianNames: [], followUpOfWoNumber: null,
      statusHistory: [{ status: 'COMPLETED', changedBy: 'a', changedByName: 'Asitha', changedAt: ts('2026-09-25T09:00:00Z'), note: null }],
      aiRca: { source: 'ai', summary: 'Seal wear', rootCause: 'Wear', rootCauseCategory: 'wear_and_tear', contributingFactors: [], evidence: [], preventiveActions: [], confidence: 'medium', generatedAt: ts('2026-09-26T09:30:00Z') },
      createdAt: ts('2026-09-24T15:23:00Z'), checklist: [], partsUsed: [], technicianWorkLogs: [], postRepairChecklist: [], finalPhotos: [], documents: [],
    } as never);
    expect(saved.pop()).toBe('WO-2026-0003.pdf');
    const pdf = outputs.pop()!;

    // Both permits — with the WO and from the Work Permits tab — with dates and extension.
    expect(pdf).toContain('Work permit PTW-2026-0001 - Hot work on booth');
    expect(pdf).toContain('Raised with the work order');
    expect(pdf).toContain('Work permit PTW-2026-0002 - Electrical isolation');
    expect(pdf).toContain('Work Permits tab');
    expect(pdf).toContain('Originally due');
    expect(pdf).toContain('Extensions');
    // RCA author — person (5-Whys) and AI, each labelled.
    expect(pdf).toContain('Human - Asitha');
    expect(pdf).toContain('Root-cause analysis - by AI');
    expect(pdf).toContain('AI \\(FirmiCore AI assistant\\)');
    // Empty fields and empty sections are left out.
    expect(pdf).not.toContain('Contractor technicians');
    expect(pdf).not.toContain('Follow-up of');
    expect(pdf).not.toContain('Special tools');
    expect(pdf).not.toContain('Task checklist');
    expect(pdf).not.toContain('Hazards');
    expect(pdf).not.toMatch(/\(-\)\s*Tj/);
  });
});
