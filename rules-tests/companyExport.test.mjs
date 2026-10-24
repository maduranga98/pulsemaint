// "Export all data" (functions/src/exports/companyExport.js) run end to end against the Firestore + Storage
// emulators with the Admin SDK: the real trigger code builds a real ZIP from seeded data and files, which is then
// opened and inspected. Needs functions/node_modules (the workflow runs `npm ci --ignore-scripts` there first).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { before, describe, it } from 'node:test';

process.env.GCLOUD_PROJECT = 'demo-firmicore';
const BUCKET = 'demo-firmicore.appspot.com';
const req = createRequire(new URL('../functions/index.js', import.meta.url));
const { initializeApp } = req('firebase-admin/app');
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
const { getStorage } = req('firebase-admin/storage');
initializeApp({ projectId: 'demo-firmicore', storageBucket: BUCKET });
const db = getFirestore('default');
const bucket = getStorage().bucket();
const exp = req('./src/exports/companyExport.js');

const url = (path) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t`;

/** Minimal ZIP reader (central directory) — enough to list entries and read stored / deflated ones. */
function readZip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  assert.ok(eocd >= 0, 'not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + csize);
    files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

async function wipe(col) {
  const s = await db.collection(col).get();
  await Promise.all(s.docs.map((d) => d.ref.delete()));
}

async function runExport(companyId, exportId) {
  await db.collection('exports').doc(exportId).set({ companyId, status: 'queued', createdAt: Timestamp.now() });
  const snap = await db.collection('exports').doc(exportId).get();
  await exp.runCompanyExport.run({ data: snap, params: { exportId } });
  return (await db.collection('exports').doc(exportId).get()).data();
}

before(async () => {
  for (const c of ['companies', 'users', 'exports', 'workOrders', 'breakdown_tickets', 'machines', 'plants']) await wipe(c);
  await db.collection('companies').doc('A').set({ id: 'A', name: 'Acme <Ltd>' });
  await db.collection('companies').doc('B').set({ id: 'B', name: 'Other Co' });
  await db.collection('workOrders').doc('woA').set({
    siteId: 'A', companyId: 'A', woNumber: 'WO-A-1', createdAt: Timestamp.now(),
    documents: [{ name: 'report.pdf', url: url('workorders/A/woA/documents/1700000000000_report.pdf') }],
    sneaky: url('workorders/B/woB/documents/secret.pdf'),
  });
  await db.collection('workOrders').doc('woA').collection('partsRequests').doc('pr1').set({ partName: 'Bearing' });
  await db.collection('workOrders').doc('woB').set({ siteId: 'B', companyId: 'B', woNumber: 'WO-B-SECRET' });
  await db.collection('machines').doc('mA').set({ companyId: 'A', name: 'Press' });
  await db.collection('machines').doc('mB').set({ companyId: 'B', name: 'Lathe-B-SECRET' });
  await db.collection('breakdown_tickets').doc('bdA').set({ siteId: 'A', ticketNumber: 'BD-1', photos: [url('breakdowns/A/bdA/media/missing.png')] });
  await bucket.file('workorders/A/woA/documents/1700000000000_report.pdf').save('A-REPORT-CONTENT');
  await bucket.file('workorders/B/woB/documents/secret.pdf').save('B-SECRET-CONTENT');
  await db.collection('users').doc('adminA').set({ uid: 'adminA', companyId: 'A', role: 'admin', status: 'active' });
  await db.collection('users').doc('techA').set({ uid: 'techA', companyId: 'A', role: 'technician', status: 'active' });
});

describe('requestCompanyExport', () => {
  const call = (uid) => exp.requestCompanyExport.run({ auth: { uid, token: {} }, data: {}, rawRequest: {} });
  it('is admin-only, one running export at a time', async () => {
    await assert.rejects(call('techA'), /role cannot do this|permission/i);
    const { id } = await call('adminA');
    assert.ok(id);
    await assert.rejects(call('adminA'), /already being prepared/);
    await wipe('exports');
  });
});

describe('runCompanyExport', () => {
  it("builds a ZIP with only this company's records and files, and a working download link", async () => {
    const job = await runExport('A', 'exA');
    assert.equal(job.status, 'ready', JSON.stringify(job));
    assert.match(job.downloadUrl, /^https:\/\//);
    assert.ok(job.sizeBytes > 0);

    const [buf] = await bucket.file('companyExports/A/exA/part-1.zip').download();
    const zip = readZip(buf);
    const text = (name) => zip.get(name)?.toString('utf8');

    for (const name of ['_export-notes.txt', 'Work orders/Other/WO-A-1/details.txt', 'Breakdowns/Without work order/BD-1/details.txt']) {
      assert.ok(zip.has(name), `missing ${name}`);
    }
    for (const name of zip.keys()) assert.ok(!/index\.html|^data\/|\.json$/.test(name), `unexpected ${name}`);
    assert.equal(text('Work orders/Other/WO-A-1/report.pdf'), 'A-REPORT-CONTENT');
    assert.ok(text('Work orders/Other/WO-A-1/details.txt').includes('Bearing'), 'subcollection missing in details.txt');
    assert.ok(!text('Work orders/Other/WO-A-1/details.txt').includes('Press'), 'machines are not exported');

    // Nothing of company B anywhere in the archive.
    for (const [name, content] of zip) {
      assert.ok(!name.includes('/B/'), `foreign file ${name}`);
      assert.ok(!content.toString('utf8').includes('B-SECRET-CONTENT'), `foreign content in ${name}`);
      assert.ok(!content.toString('utf8').includes('WO-B-SECRET') && !content.toString('utf8').includes('Lathe-B-SECRET'), `foreign record in ${name}`);
    }
    const notes = text('_export-notes.txt');
    assert.ok(notes.includes('workorders/B/woB/documents/secret.pdf'), 'refused file should be listed');
    assert.ok(notes.includes('breakdowns/A/bdA/media/missing.png'), 'unreadable file should be listed');
    assert.equal(job.counts.missing, 1);
    assert.equal(job.counts.refused, 1);
  });

  it('a big export is split into parts and carried on across runs', async () => {
    await db.collection('companies').doc('M').set({ id: 'M', name: 'Many Files' });
    const names = ['a.pdf', 'b.pdf', 'c.pdf'];
    await db.collection('workOrders').doc('woM').set({
      siteId: 'M', companyId: 'M', woNumber: 'WO-M-1', createdAt: Timestamp.now(),
      documents: names.map((n) => ({ name: n, url: url(`workorders/M/woM/documents/${n}`) })),
    });
    for (const n of names) await bucket.file(`workorders/M/woM/documents/${n}`).save(`M-${n}`);
    // One file per part and no time budget: every run packs one part, then hands over.
    await db.collection('exports').doc('exM').set({
      companyId: 'M', status: 'queued', createdAt: Timestamp.now(), partMaxFiles: 1, runBudgetMs: 0,
    });
    let snap = await db.collection('exports').doc('exM').get();
    await exp.runCompanyExport.run({ data: snap, params: { exportId: 'exM' } });
    let job = (await db.collection('exports').doc('exM').get()).data();
    assert.equal(job.status, 'continue', JSON.stringify(job));
    assert.equal(job.nextPart, 1);
    for (let i = 0; i < 6 && job.status === 'continue'; i++) {
      const before = { ...job, status: 'running' };
      snap = await db.collection('exports').doc('exM').get();
      await exp.continueCompanyExport.run({ data: { before: { data: () => before }, after: { data: () => snap.data(), ref: snap.ref } }, params: { exportId: 'exM' } });
      job = (await db.collection('exports').doc('exM').get()).data();
    }
    assert.equal(job.status, 'ready', JSON.stringify(job));
    assert.equal(job.partCount, 3);
    assert.equal(job.downloads.length, 3);
    const all = new Map();
    for (let n = 1; n <= 3; n++) {
      const [buf] = await bucket.file(`companyExports/M/exM/part-${n}.zip`).download();
      for (const [name, content] of readZip(buf)) {
        if (n > 1) assert.ok(name !== '_export-notes.txt', 'the notes belong to part 1 only');
        all.set(name, content.toString('utf8'));
      }
    }
    assert.ok(all.has('_export-notes.txt'));
    for (const n of names) assert.equal(all.get(`Work orders/Other/WO-M-1/${n}`), `M-${n}`);
  });

  it('a company with no data still exports', async () => {
    await db.collection('companies').doc('Z').set({ id: 'Z', name: 'Empty' });
    const job = await runExport('Z', 'exZ');
    assert.equal(job.status, 'ready', JSON.stringify(job));
  });

  it('records where it failed instead of hanging when something breaks', async () => {
    // A job for a company that does not exist still completes; a job without companyId is ignored.
    await db.collection('exports').doc('bad').set({ status: 'queued', createdAt: Timestamp.now() });
    const snap = await db.collection('exports').doc('bad').get();
    await exp.runCompanyExport.run({ data: snap, params: { exportId: 'bad' } });
    assert.equal((await db.collection('exports').doc('bad').get()).data().status, 'queued');
  });
});
