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
      doc: (id: string) => ({ collection: (sub: string) => mkCol(`${path}/${id}/${sub}`) }),
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
    woA1: { siteId: 'A', companyId: 'A', woNumber: 'WO-A-1', createdAt: ts('2026-01-02T03:04:05Z'), documents: [{ name: 'report.pdf', url: url('workorders/A/woA1/documents/1700000000000_report.pdf') }], finalPhotos: [url('workorders/A/woA1/completion/photos/p1.jpg')] },
    woA2: { siteId: 'A', woNumber: 'WO-A-2</script><script>alert(1)</script>', description: '=HYPERLINK("http://evil")', stolen: url('workorders/B/woB1/documents/secret.pdf'), traversal: 'companies/A/../B/x/secret.pdf' },
    woB1: { siteId: 'B', companyId: 'B', woNumber: 'WO-B-1', documents: [url('workorders/B/woB1/documents/secret.pdf')] },
  },
  'workOrders/woA1/partsRequests': { pr1: { partName: 'Bearing' } },
  breakdown_tickets: { bdA: { siteId: 'A', ticketNumber: 'BD-1', photos: [url('breakdowns/A/bdA/media/x.png')] }, bdB: { siteId: 'B', ticketNumber: 'BD-B' } },
  machines: { mA: { companyId: 'A', name: 'Press' }, mB: { companyId: 'B', name: 'Lathe B' } },
  'audit_sessions/P1/sessions': { s1: { title: 'Plant audit', evidence: [url('audit_attachments/P1/s1/e.jpg')] } },
  'audit_sessions/OTHER/sessions': { s2: { title: 'Other company audit' } },
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

describe('gatherCompanyData', () => {
  it("exports only the company's own records and files", async () => {
    const g = await gatherCompanyData({ db: fakeDb(store), companyId: 'A', plantIds: ['P1'], bucketName: BUCKET });
    const wo = g.datasets.workOrders.collections.workOrders.map((r: any) => r.id).sort();
    expect(wo).toEqual(['woA1', 'woA2']); // not woB1
    expect(g.datasets.breakdowns.collections.breakdown_tickets.map((r: any) => r.id)).toEqual(['bdA']);
    expect(g.datasets.machines.collections.machines.map((r: any) => r.id)).toEqual(['mA']);
    expect(g.datasets.audits.collections.audit_sessions.map((r: any) => r.id)).toEqual(['s1']); // plant P1, not OTHER

    const paths = [...g.files.keys()].sort();
    expect(paths).toEqual([
      'audit_attachments/P1/s1/e.jpg',
      'breakdowns/A/bdA/media/x.png',
      'workorders/A/woA1/completion/photos/p1.jpg',
      'workorders/A/woA1/documents/1700000000000_report.pdf',
    ]);
    expect(g.refused).toContain('workorders/B/woB1/documents/secret.pdf'); // A's record pointing at B's file
    expect(paths.some((p) => p.includes('/B/'))).toBe(false);
  });

  it('keeps subcollections, serialises timestamps and names attachments readably', async () => {
    const g = await gatherCompanyData({ db: fakeDb(store), companyId: 'A', plantIds: [], bucketName: BUCKET });
    const rec = g.datasets.workOrders.collections.workOrders.find((r: any) => r.id === 'woA1');
    expect(rec.title).toBe('WO-A-1');
    expect(rec.data.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(rec.sub.partsRequests[0].partName).toBe('Bearing');
    const report = rec.attachments.find((a: any) => a.file.endsWith('report.pdf'));
    expect(report.name).toBe('report.pdf'); // timestamp prefix stripped
    expect(report.file).toBe('Work orders/WO-A-1/report.pdf'); // inside the work order's own folder
    expect(rec.folder).toBe('Work orders/WO-A-1');
  });
});

describe('buildTextEntries', () => {
  it('writes the viewer, per-collection JSON/CSV and notes — safe against injected markup and formulas', async () => {
    const g = await gatherCompanyData({ db: fakeDb(store), companyId: 'A', plantIds: ['P1'], bucketName: BUCKET });
    const entries = buildTextEntries({ company: 'Acme <Ltd>', exportedAt: '2026-10-23T00:00:00Z', datasets: g.datasets, missing: ['workorders/A/woA1/completion/photos/p1.jpg'], refused: g.refused });
    const byName = Object.fromEntries(entries.map((e: any) => [e.name, e.content as string]));
    for (const name of ['index.html', 'data/workOrders.json', 'data/workOrders.csv', 'data/machines.csv', '_export-notes.txt',
      'Work orders/WO-A-1/details.txt', 'Work orders/WO-A-1/details.json', 'Breakdowns/Breakdown tickets/BD-1/details.txt']) {
      expect(byName[name], name).toBeTruthy();
    }
    // </script> inside a record can never close the data <script>.
    expect(byName['index.html'].match(/<\/script>/g)).toHaveLength(2);
    expect(byName['index.html']).toContain('FC_DATA');
    // The readable summary uses labels, not field names, and formats dates.
    expect(byName['Work orders/WO-A-1/details.txt']).toContain('Wo number: WO-A-1');
    expect(byName['Work orders/WO-A-1/details.txt']).toContain('Created at: 2026-01-02 03:04 UTC');
    expect(byName['index.html']).toContain('Acme &lt;Ltd&gt;');
    expect(byName['index.html']).not.toContain('Acme <Ltd>');
    // Spreadsheet formulas are neutralised in CSV.
    expect(byName['data/workOrders.csv']).toContain("'=HYPERLINK");
    // The other company's names never appear anywhere.
    expect(entries.some((e: any) => String(e.content).includes('WO-B-1') || String(e.content).includes('Lathe B'))).toBe(false);
    // Unreadable / foreign files are listed in the notes, foreign ones never linked from a record.
    expect(byName['_export-notes.txt']).toContain('workorders/A/woA1/completion/photos/p1.jpg');
    expect(byName['_export-notes.txt']).toContain('workorders/B/woB1/documents/secret.pdf');
    expect(byName['index.html']).not.toContain('workorders/B/');
  });

  it('handles a company with no data', async () => {
    const g = await gatherCompanyData({ db: fakeDb({}), companyId: 'Z', plantIds: [], bucketName: BUCKET });
    expect(g.counts).toEqual({ records: 0, files: 0 });
    expect(buildTextEntries({ company: 'Empty', exportedAt: 'now', datasets: g.datasets, missing: [], refused: [] }).length).toBeGreaterThan(5);
  });
});

describe('folders and names', () => {
  it('safeName keeps readable letters and removes unsafe characters and reserved names', () => {
    expect(plan.safeName('BD-2026/0012')).toBe('BD-2026_0012');
    expect(plan.safeName('  ..weird:name?.  ')).toBe('weird_name_');
    expect(plan.safeName('CON')).toBe('_CON');
    expect(plan.safeName('', 'x')).toBe('x');
    expect(plan.safeName('යන්ත්‍රය 1')).toContain('යන්ත්');
  });

  it('gives every record its own folder, with a suffix when two share a number, and de-duplicates file names', () => {
    const section = { label: 'Breakdowns', collections: [{ name: 'breakdown_tickets', label: 'Breakdown tickets' }, { name: 'rca', label: 'Root cause analyses' }] };
    const list: Array<{ id: string; title: string; folder?: string; attachments: Array<{ name: string; file: string }> }> = [
      { id: 'abc123456', title: 'BD-1', attachments: [{ name: 'photo.jpg', file: '' }, { name: 'photo.jpg', file: '' }, { name: 'details.txt', file: '' }] },
      { id: 'zzz987654', title: 'BD-1', attachments: [] },
    ];
    plan.assignFolders(section, section.collections[0], list);
    expect(list[0].folder).toBe('Breakdowns/Breakdown tickets/BD-1');
    expect(list[1].folder).toBe('Breakdowns/Breakdown tickets/BD-1 (zzz98765)');
    expect(list[0].attachments.map((a: any) => a.file)).toEqual([
      'Breakdowns/Breakdown tickets/BD-1/photo.jpg',
      'Breakdowns/Breakdown tickets/BD-1/photo (2).jpg',
      'Breakdowns/Breakdown tickets/BD-1/details (2).txt',
    ]);
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
