// functions/src/machines/departmentStamps.js against the Firestore emulator: a work order / ticket created
// without machineDepartment gets its machine's, other companies' machines are ignored, a machine moved to another
// department takes its OPEN work with it, and the backfill stamps existing records once.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

process.env.GCLOUD_PROJECT = 'demo-firmicore';
const req = createRequire(new URL('../functions/index.js', import.meta.url));
const { initializeApp } = req('firebase-admin/app');
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
initializeApp({ projectId: 'demo-firmicore' });
const db = getFirestore('default');
const ds = req('./src/machines/departmentStamps.js');

async function wipe(col) {
  const s = await db.collection(col).get();
  await Promise.all(s.docs.map((d) => d.ref.delete()));
}
async function runStamp(fn, collection, id, beforeData) {
  const ref = db.collection(collection).doc(id);
  const after = await ref.get();
  await fn.run({
    params: { id },
    data: {
      before: beforeData ? { exists: true, data: () => beforeData } : { exists: false, data: () => undefined },
      after: { exists: after.exists, data: () => after.data(), ref },
    },
  });
  return (await ref.get()).data();
}

before(async () => {
  for (const c of ['machines', 'workOrders', 'breakdown_tickets', 'system']) await wipe(c);
  await db.collection('machines').doc('m1').set({ siteId: 'A', name: 'Press', department: ' Stamping ' });
  await db.collection('machines').doc('mB').set({ siteId: 'B', name: 'Other', department: 'Secret' });
});

describe('needsDepartmentStamp', () => {
  it('only machine-linked records without a department, or that changed machine', () => {
    assert.equal(ds.needsDepartmentStamp(null, { machineId: 'm1' }), true);
    assert.equal(ds.needsDepartmentStamp(null, { machineId: 'm1', machineDepartment: '  ' }), true);
    assert.equal(ds.needsDepartmentStamp(null, { machineId: 'm1', machineDepartment: 'Stamping' }), false);
    assert.equal(ds.needsDepartmentStamp({ machineId: 'm1' }, { machineId: 'm2', machineDepartment: 'X' }), true);
    assert.equal(ds.needsDepartmentStamp(null, { description: 'no machine' }), false);
  });
});

describe('stamp triggers', () => {
  it('stamp the machine department on a record that has none', async () => {
    await db.collection('workOrders').doc('wo1').set({ siteId: 'A', machineId: 'm1', status: 'OPEN', createdAt: Timestamp.now() });
    assert.equal((await runStamp(ds.stampDepartmentOnWorkOrder, 'workOrders', 'wo1', null)).machineDepartment, 'Stamping');
    await db.collection('breakdown_tickets').doc('bd1').set({ siteId: 'A', machineId: 'm1', status: 'reported' });
    assert.equal((await runStamp(ds.stampDepartmentOnBreakdown, 'breakdown_tickets', 'bd1', null)).machineDepartment, 'Stamping');
  });
  it("never take another company's machine department", async () => {
    await db.collection('workOrders').doc('woX').set({ siteId: 'A', machineId: 'mB', status: 'OPEN' });
    const data = await runStamp(ds.stampDepartmentOnWorkOrder, 'workOrders', 'woX', null);
    assert.ok(!data.machineDepartment, JSON.stringify(data));
  });
  it('leave an existing department alone', async () => {
    await db.collection('workOrders').doc('woKeep').set({ siteId: 'A', machineId: 'm1', status: 'OPEN', machineDepartment: 'Welding' });
    assert.equal((await runStamp(ds.stampDepartmentOnWorkOrder, 'workOrders', 'woKeep', null)).machineDepartment, 'Welding');
  });
});

describe('propagateMachineDepartment', () => {
  it('moves open work with the machine, leaves closed history', async () => {
    await db.collection('workOrders').doc('woOpen').set({ siteId: 'A', machineId: 'm1', status: 'OPEN', machineDepartment: 'Stamping' });
    await db.collection('workOrders').doc('woClosed').set({ siteId: 'A', machineId: 'm1', status: 'CLOSED', machineDepartment: 'Stamping' });
    await db.collection('machines').doc('m1').update({ department: 'Welding' });
    const m = await db.collection('machines').doc('m1').get();
    await ds.propagateMachineDepartment.run({
      params: { machineId: 'm1' },
      data: { before: { exists: true, data: () => ({ siteId: 'A', department: 'Stamping' }) }, after: { exists: true, data: () => m.data() } },
    });
    assert.equal((await db.collection('workOrders').doc('woOpen').get()).data().machineDepartment, 'Welding');
    assert.equal((await db.collection('workOrders').doc('woClosed').get()).data().machineDepartment, 'Stamping');
  });
});

describe('backfillDepartmentStamps', () => {
  it('stamps existing records once, then idles', async () => {
    await db.collection('workOrders').doc('woOld').set({ siteId: 'A', machineId: 'm1', status: 'CLOSED' });
    await db.collection('breakdown_tickets').doc('bdOld').set({ siteId: 'A', machineId: 'm1', status: 'closed' });
    await ds.backfillDepartmentStamps.run({});
    assert.equal((await db.collection('workOrders').doc('woOld').get()).data().machineDepartment, 'Welding');
    assert.equal((await db.collection('breakdown_tickets').doc('bdOld').get()).data().machineDepartment, 'Welding');
    assert.ok((await db.doc('system/departmentStampBackfill').get()).data().completedAt);
    await db.collection('workOrders').doc('woLater').set({ siteId: 'A', machineId: 'm1', status: 'CLOSED' });
    await ds.backfillDepartmentStamps.run({});
    assert.ok(!(await db.collection('workOrders').doc('woLater').get()).data().machineDepartment, 'second run must be a no-op');
  });
});
