import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// The export logic lives in Cloud Functions (CommonJS, no Firebase imports in these two files).
const nodeRequire = createRequire(import.meta.url);
const plan = nodeRequire('../../../functions/src/exports/exportPlan.js');
const { gatherCompanyData, buildTextEntries } = nodeRequire('../../../functions/src/exports/gather.js');

const BUCKET = 'pulsemaint.appspot.com';
const url = (path: string) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t`;
const ts = (iso: string) => ({ toDate: () => new Date(iso) });

type Doc = Record<string, unknown>;
/** Minimal in-memory Firestore: where('==') + orderBy('__name__') + limit/startAfter, doc().collection(), ref.collection(). */
function fakeDb(store: Record<string, Record<string, Doc>>) {
  const mkDoc = (colPath: string, id: string, data: Doc) => ({
    id,
    data: () => data,
    get: (f: string) => data[f],
    ref: { path: `${colPath}/${id}`, collection: (sub: string) => mkCol(`${colPath}/${id}/${sub}`) },
  });
  const mkCol = (path: string): any => {
    const filters: [string, unknown][] = [];
    let after: string | null = null;
    let max = Infinity;
    const q: any = {
      where: (f: string, _op: string, v: unknown) => { filters.push([f, v]); return q; },
      orderBy: () => q,
      limit: (n: number) => { max = n; return q; },
      startAfter: (d: { id: string }) => { after = d.id; return q; },
      doc: (id: string) => ({
        collection: (sub: string) => mkCol(`${path}/${id}/${sub}`),
        get: async () => ({ exists: !!store[path]?.[id], get: (f: string) => store[path]?.[id]?.[f] }),
      }),
      get: async () => {
        let rows = Object.entries(store[path] ?? {}).sort(([a], [b]) => a.localeCompare(b));
        rows = rows.filter(([, d]) => filters.every(([f, v]) => d[f] === v));
        if (after) rows = rows.filter(([id]) => id > after!);
        rows = rows.slice(0, max);
        const docs = rows.map(([id, d]) => mkDoc(path, id, d));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
    return q;
  };
  return { collection: (name: string) => mkCol(name) };
}

const store = {
  workOrders: {
    woA1: { siteId: 'A', companyId: 'A', woNumber: 'WO-A-1', woType: 'CONTRACTOR', status: 'IN_PROGRESS', createdBy: 'uidTechA0123456789abcdefgh', plantId: 'plantMain0123456789abcd', createdAt: ts('2026-01-02T03:04:05Z'), documents: [{ name: 'report.pdf', url: url('workorders/A/woA1/documents/1700000000000_report.pdf') }], finalPhotos: [url('workorders/A/woA1/completion/photos/p1.jpg')] },
    woA2: { siteId: 'A', woNumber: 'WO-A-2</script><script>alert(1)</script>', woType: 'PREVENTIVE', linkedBreakdownId: 'bdHigh1', description: '=HYPERLINK("http://evil")', stolen: url('workorders/B/woB1/documents/secret.pdf'), traversal: 'companies/A/../B/x/secret.pdf' },
    woB1: { siteId: 'B', companyId: 'B', woNumber: 'WO-B-1', documents: [url('workorders/B/woB1/documents/secret.pdf')] },
  },
  'workOrders/woA1/partsRequests': { pr1: { partName: 'Bearing' } },
  breakdown_tickets: {
    bdLow1: { siteId: 'A', ticketNumber: 'BD-LOW', severity: 'low', source: 'qr_scan', assignedTechnician: 'uidTechA0123456789abcdefgh', photos: [url('breakdowns/A/bdLow1/media/x.png')] },
    bdHigh1: { siteId: 'A', ticketNumber: 'BD-HIGH-1', severity: 'high', reportedAt: ts('2026-01-01T00:00:00Z'), photos: [url('breakdowns/A/bdHigh1/media/a.png')] },
    bdHigh2: { siteId: 'A', ticketNumber: 'BD-HIGH-2', severity: 'critical', reportedAt: ts('2026-01-02T00:00:00Z'), linkedWOId: 'woA2', photos: [url('breakdowns/A/bdHigh2/media/a.png')] },
    bdLone: { siteId: 'A', ticketNumber: 'BD-LONE', severity: 'medium' },
    bdB: { siteId: 'B', ticketNumber: 'BD-B' },
  },
  safety_cases: { sc1: { companyId: 'A', caseNumber: 'SC-1', photos: [url('companies/A/safety/p.jpg')], status: 'closed' } },
  work_permits: {
    wp1: { companyId: 'A', permitNumber: 'WP-1', workOrderNumber: 'WO-A-1', status: 'active', attachments: [url('companies/A/permits/a.pdf')] },
    wp2: { companyId: 'A', permitNumber: 'WP-2', workOrderNumber: 'WO-A-1', status: 'closed' },
    wp3: { companyId: 'A', permitNumber: 'WP-3' },
  },
  shift_handovers: { h1: { companyId: 'A', shiftName: 'Day', shiftDate: '2026-10-22', outgoingSupervisorId: 'uidTechA0123456789abcdefgh', generalNotes: 'a,b "c"', status: 'accepted' } },
  machines: { mA: { companyId: 'A', name: 'Press' }, mB: { companyId: 'B', name: 'Lathe B' } },
  'companies/A/users': { uidTechA0123456789abcdefgh: { fullName: 'Sanju' } },
  companies: { A: { name: 'Acme <Ltd>' } },
  plants: { plantMain0123456789abcd: { companyId: 'A', name: 'Main plant' } },
};

describe('isAllowedStoragePath', () => {
  it('accepts only this company / its plants, never another company, roots or traversal', () => {
    expect(plan.isAllowedStoragePath('workorders/A/wo/x.pdf', 'A', ['P1'])).toBe(true);
    expect(plan.isAllowedStoragePath('audit_attachments/P1/s/x.jpg', 'A', ['P1'])).toBe(true);
    expect(plan.isAllowedStoragePath('workorders/B/wo/x.pdf', 'A', ['P1'])).toBe(false);
    expect(plan.isAllowedStoragePath('audit_attachments/P9/s/x.jpg', 'A', ['P1'])).toBe(false);
    expect(plan.isAllowedStoragePath('companies/A/../B/x.pdf', 'A', [])).toBe(false);
    expect(plan.isAllowedStoragePath('secrets/A/x.pdf', 'A', [])).toBe(false);
    expect(plan.isAllowedStoragePath('/companies/A/x.pdf', 'A', [])).toBe(false);
  });
});

const gather = (companyId = 'A') => gatherCompanyData({ db: fakeDb(store), companyId, plantIds: ['P1'], bucketName: BUCKET });
const build = (g: any, missing: string[] = []) => {
  const entries = buildTextEntries({ company: 'Acme <Ltd>', exportedAt: '2026-10-23T00:00:00Z', datasets: g.datasets, missing, refused: g.refused });
  return { entries, byName: Object.fromEntries(entries.map((e: any) => [e.name, e.content as string])) as Record<string, string> };
};

describe('gatherCompanyData', () => {
  it("exports only the five requested sections, only the company's own records and files", async () => {
    const g = await gather();
    expect(Object.keys(g.datasets).filter((k) => k !== '_names').sort()).toEqual(['breakdowns', 'handovers', 'safety', 'workOrders', 'workPermits']);
    expect(g.datasets.workOrders.collections.workOrders.map((r: any) => r.id).sort()).toEqual(['woA1', 'woA2']); // not woB1
    expect(g.datasets.breakdowns.collections.breakdown_tickets.map((r: any) => r.id).sort()).toEqual(['bdHigh1', 'bdHigh2', 'bdLone', 'bdLow1']);
    const paths = [...g.files.keys()].sort();
    expect(paths).toEqual([
      'breakdowns/A/bdHigh1/media/a.png',
      'breakdowns/A/bdHigh2/media/a.png',
      'breakdowns/A/bdLow1/media/x.png',
      'workorders/A/woA1/completion/photos/p1.jpg',
      'workorders/A/woA1/documents/1700000000000_report.pdf',
    ]); // safety case / permit files are never collected
    expect(g.refused).toContain('workorders/B/woB1/documents/secret.pdf');
    expect(paths.some((p) => p.includes('/B/'))).toBe(false);
  });

  it('puts work orders in <type>/<WO number> folders with readable file names', async () => {
    const g = await gather();
    const rec = g.datasets.workOrders.collections.workOrders.find((r: any) => r.id === 'woA1');
    expect(rec.folder).toBe('Work orders/Contractor/WO-A-1');
    expect(rec.textPath).toBe('Work orders/Contractor/WO-A-1/details.txt');
    expect(rec.data.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(rec.sub.partsRequests[0].partName).toBe('Bearing');
    const report = rec.attachments.find((a: any) => a.file.endsWith('report.pdf'));
    expect(report.name).toBe('report.pdf'); // timestamp prefix stripped
    expect(report.file).toBe('Work orders/Contractor/WO-A-1/report.pdf');
  });

  it('lays breakdowns out: low severity per ticket, others grouped under their WO number', async () => {
    const g = await gather();
    const byId = Object.fromEntries(g.datasets.breakdowns.collections.breakdown_tickets.map((r: any) => [r.id, r]));
    expect(byId.bdLow1.folder).toBe('Breakdowns/Low severity/BD-LOW');
    expect(byId.bdLow1.textPath).toBe('Breakdowns/Low severity/BD-LOW/details.txt');
    // bdHigh1 is linked from the work order (linkedBreakdownId), bdHigh2 links to it (linkedWOId): same WO, same folder + file.
    const woFolder = 'Breakdowns/' + plan.safeName('WO-A-2</script><script>alert(1)</script>');
    expect(byId.bdHigh1.folder).toBe(woFolder);
    expect(byId.bdHigh2.folder).toBe(woFolder);
    expect(byId.bdHigh1.textPath).toBe(`${woFolder}/breakdown tickets.txt`);
    expect(byId.bdHigh2.textPath).toBe(byId.bdHigh1.textPath);
    expect(byId.bdHigh1.attachments[0].file).toBe(`${woFolder}/a.png`);
    expect(byId.bdHigh2.attachments[0].file).toBe(`${woFolder}/a (2).png`);
    expect(byId.bdLone.folder).toBe('Breakdowns/Without work order/BD-LONE');
  });
});

describe('buildTextEntries', () => {
  it('writes text files only — no viewer, no data lists — safe against injected formulas', async () => {
    const g = await gather();
    const { entries, byName } = build(g, ['workorders/A/woA1/completion/photos/p1.jpg']);
    const names = entries.map((e: any) => e.name);
    expect(names.sort()).toEqual([
      '_export-notes.txt',
      'Breakdowns/Low severity/BD-LOW/details.txt',
      'Breakdowns/Without work order/BD-LONE/details.txt',
      'Breakdowns/' + plan.safeName('WO-A-2</script><script>alert(1)</script>') + '/breakdown tickets.txt',
      'Safety cases/SC-1.txt',
      'Shift handovers/Shift handovers.csv',
      'Work orders/Contractor/WO-A-1/details.txt',
      'Work orders/Preventive/' + plan.safeName('WO-A-2</script><script>alert(1)</script>') + '/details.txt',
      'Work permits/WO-A-1.txt',
      'Work permits/WP-3.txt',
    ].sort());
    expect(byName['Work orders/Contractor/WO-A-1/details.txt']).toContain('WO number: WO-A-1');
    expect(byName['Work orders/Contractor/WO-A-1/details.txt']).toContain('Created at: 2026-01-02 03:04 UTC');
    // The two breakdowns of one work order share a file; both permits of WO-A-1 too.
    const bd = byName['Breakdowns/' + plan.safeName('WO-A-2</script><script>alert(1)</script>') + '/breakdown tickets.txt'];
    expect(bd).toContain('BD-HIGH-1');
    expect(bd).toContain('BD-HIGH-2');
    expect(byName['Work permits/WO-A-1.txt']).toContain('WP-1');
    expect(byName['Work permits/WO-A-1.txt']).toContain('WP-2');
    // Spreadsheet: BOM, readable headers, names instead of ids, formulas neutralised.
    const csv = byName['Shift handovers/Shift handovers.csv'];
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('Outgoing supervisor');
    expect(csv).toContain('Sanju');
    expect(csv).toContain('"a,b ""c"""');
    expect(byName['Work orders/Preventive/' + plan.safeName('WO-A-2</script><script>alert(1)</script>') + '/details.txt']).toContain('=HYPERLINK');
    // The other company's names never appear anywhere.
    expect(entries.some((e: any) => String(e.content).includes('WO-B-1') || String(e.content).includes('Lathe B'))).toBe(false);
    expect(byName['_export-notes.txt']).toContain('workorders/A/woA1/completion/photos/p1.jpg');
    expect(byName['_export-notes.txt']).toContain('workorders/B/woB1/documents/secret.pdf');
  });

  it('shows names and readable words instead of codes', async () => {
    const g = await gather();
    const { byName } = build(g);
    const wo = byName['Work orders/Contractor/WO-A-1/details.txt'];
    expect(wo).toContain('Status: In progress');
    expect(wo).toContain('WO type: Contractor');
    expect(wo).toContain('Created by: Sanju');
    expect(wo).toContain('Plant: Main plant');
    expect(wo).not.toContain('uidTechA0123456789abcdefgh');
    expect(wo).not.toContain('Record id');
    const low = byName['Breakdowns/Low severity/BD-LOW/details.txt'];
    expect(low).toContain('Source: QR scan');
    expect(low).toContain('Severity: Low');
    expect(low).toContain('Assigned technician: Sanju');
  });

  it('humanizeValue only touches code-like values of enum-like fields', () => {
    expect(plan.humanizeValue('role', 'safety_officer')).toBe('Safety officer');
    expect(plan.humanizeValue('answerType', 'yes_no')).toBe('Yes no');
    expect(plan.humanizeValue('description', 'motor')).toBe('motor');
    expect(plan.humanizeValue('status', 'camelCaseId')).toBe('camelCaseId');
    expect(plan.humanizeKey('woNumber')).toBe('WO number');
  });

  it('handles a company with no data', async () => {
    const g = await gatherCompanyData({ db: fakeDb({}), companyId: 'Z', plantIds: [], bucketName: BUCKET });
    expect(g.counts).toEqual({ records: 0, files: 0 });
    expect(buildTextEntries({ company: 'Empty', exportedAt: 'now', datasets: g.datasets, missing: [], refused: [] }).map((e: any) => e.name)).toEqual(['_export-notes.txt']);
  });
});

describe('folder and file names', () => {
  it('safeName keeps readable letters and removes unsafe characters and reserved names', () => {
    expect(plan.safeName('BD-2026/0012')).toBe('BD-2026_0012');
    expect(plan.safeName('  ..weird:name?.  ')).toBe('weird_name_');
    expect(plan.safeName('CON')).toBe('_CON');
    expect(plan.safeName('', 'x')).toBe('x');
    expect(plan.safeName('යන්ත්‍රය 1')).toContain('යන්ත්');
  });

  it('gives two work orders with the same number their own folders', () => {
    const col = { layout: 'workOrder' };
    const list = [
      { id: 'abc123456', title: 'WO-1', data: { woType: 'CORRECTIVE' }, attachments: [{ name: 'photo.jpg', file: '' }, { name: 'photo.jpg', file: '' }] },
      { id: 'zzz987654', title: 'WO-1', data: { woType: 'CORRECTIVE' }, attachments: [] },
    ];
    plan.layoutSection(col, list, { woNumberById: new Map(), woNumberByTicket: new Map() });
    expect(list.map((r: any) => r.folder)).toEqual(['Work orders/Corrective/WO-1', 'Work orders/Corrective/WO-1 (zzz98765)']);
    expect(list[0].attachments.map((a: any) => a.file)).toEqual(['Work orders/Corrective/WO-1/photo.jpg', 'Work orders/Corrective/WO-1/photo (2).jpg']);
  });
});

describe('planParts (big exports are split into ZIP parts)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planParts } = require('../../../functions/src/exports/exportPlan.js');
  const e = (size: number, copies = 1) => ({ size, names: Array.from({ length: copies }, (_, i) => `f${i}`) });

  it('always returns at least one part, even with no files', () => {
    expect(planParts([], 100, 10)).toEqual([{ start: 0, end: 0, bytes: 0 }]);
  });
  it('keeps everything in one part when it fits', () => {
    expect(planParts([e(10), e(20)], 100, 10)).toEqual([{ start: 0, end: 2, bytes: 30 }]);
  });
  it('starts a new part when the size limit would be passed, covering every file once', () => {
    const parts = planParts([e(60), e(60), e(30), e(30)], 100, 10);
    expect(parts).toEqual([{ start: 0, end: 1, bytes: 60 }, { start: 1, end: 3, bytes: 90 }, { start: 3, end: 4, bytes: 30 }]);
  });
  it('gives a file bigger than the limit a part of its own', () => {
    const parts = planParts([e(10), e(500), e(10)], 100, 10);
    expect(parts.map((p: { start: number; end: number }) => [p.start, p.end])).toEqual([[0, 1], [1, 2], [2, 3]]);
  });
  it('splits on the file-count limit too, counting a shared file once per copy', () => {
    expect(planParts([e(1, 2), e(1, 2), e(1, 2)], 1000, 4).map((p: { end: number }) => p.end)).toEqual([2, 3]);
  });
});
