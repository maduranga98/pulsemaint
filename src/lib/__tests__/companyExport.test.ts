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
    expect(report.file).toBe('files/workorders/A/woA1/documents/1700000000000_report.pdf');
  });
});

describe('buildTextEntries', () => {
  it('writes the viewer, per-collection JSON/CSV and notes — safe against injected markup and formulas', async () => {
    const g = await gatherCompanyData({ db: fakeDb(store), companyId: 'A', plantIds: ['P1'], bucketName: BUCKET });
    const entries = buildTextEntries({ company: 'Acme <Ltd>', exportedAt: '2026-10-23T00:00:00Z', datasets: g.datasets, missing: ['workorders/A/woA1/completion/photos/p1.jpg'], refused: g.refused });
    const byName = Object.fromEntries(entries.map((e: any) => [e.name, e.content as string]));
    for (const name of ['index.html', 'viewer.js', 'data/manifest.js', 'data/workOrders.js', 'data/workOrders.json', 'data/workOrders.csv', 'data/machines.csv', '_export-notes.txt']) {
      expect(byName[name], name).toBeTruthy();
    }
    // </script> inside a record can never close the data <script>.
    expect(byName['data/workOrders.js']).not.toContain('</script>');
    expect(byName['index.html']).toContain('Acme &lt;Ltd&gt;');
    expect(byName['index.html']).not.toContain('Acme <Ltd>');
    // Spreadsheet formulas are neutralised in CSV.
    expect(byName['data/workOrders.csv']).toContain("'=HYPERLINK");
    // The other company's names never appear anywhere.
    expect(entries.some((e: any) => String(e.content).includes('WO-B-1') || String(e.content).includes('Lathe B'))).toBe(false);
    // Unreadable / foreign files are listed in the notes, foreign ones never linked from a record.
    expect(byName['_export-notes.txt']).toContain('workorders/A/woA1/completion/photos/p1.jpg');
    expect(byName['_export-notes.txt']).toContain('workorders/B/woB1/documents/secret.pdf');
    expect(byName['data/workOrders.js']).not.toContain('files/workorders/B/');
  });

  it('handles a company with no data', async () => {
    const g = await gatherCompanyData({ db: fakeDb({}), companyId: 'Z', plantIds: [], bucketName: BUCKET });
    expect(g.counts).toEqual({ records: 0, files: 0 });
    expect(buildTextEntries({ company: 'Empty', exportedAt: 'now', datasets: g.datasets, missing: [], refused: [] }).length).toBeGreaterThan(5);
  });
});
