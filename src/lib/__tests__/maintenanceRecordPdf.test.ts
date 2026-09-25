import { describe, it, expect, vi } from 'vitest';
import type { Timestamp } from 'firebase/firestore';

const saved: string[] = [];
vi.mock('jspdf', async (orig) => {
  const mod = await orig<typeof import('jspdf')>();
  // jsPDF attaches `save` per instance, so replace it after construction.
  class TestPDF extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      (this as unknown as { save: (n: string) => void }).save = (n: string) => { saved.push(n); };
    }
  }
  return { ...mod, jsPDF: TestPDF };
});
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ company: { name: 'Acme Ltd' } }) } }));
vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: {}, functions: {} }));
vi.mock('../../utils/reports/pdf/pdfFonts', () => ({ registerUnicodeFont: async () => 'helvetica' }));

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
});
