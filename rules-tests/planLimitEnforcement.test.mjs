// Server-side plan-limit triggers (functions/src/billing/planLimitEnforcement.js), run against the Firestore
// emulator with the Admin SDK: records past the plan limit are removed (oldest are kept), nothing else is touched.
// Needs functions/node_modules (the workflow runs `npm ci --ignore-scripts` there first).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

process.env.GCLOUD_PROJECT = 'demo-firmicore';
const req = createRequire(new URL('../functions/index.js', import.meta.url));
const { initializeApp } = req('firebase-admin/app');
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
initializeApp({ projectId: 'demo-firmicore' });
const db = getFirestore('default');
const enf = req('./src/billing/planLimitEnforcement.js')._test;
const ai = req('./src/ai/aiUsageLimit.js');

const T0 = Date.now() - 100000;
const ts = (i) => Timestamp.fromMillis(T0 + i * 1000);
const ok = (c, m) => assert.ok(c, m);

async function reset() {
  for (const c of ['machines', 'inventoryParts', 'pm_schedules', 'plants', 'companies', 'planLimitViolations', 'inviteTokens']) {
    const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
}
async function seedCompany(id, extra = {}) { await db.collection('companies').doc(id).set({ id, plan: 'starter', status: 'active', ...extra }); }
async function addMachines(companyId, n, startIdx = 0, extra = () => ({})) {
  const refs = [];
  for (let i = 0; i < n; i++) { const r = db.collection('machines').doc(`m${startIdx + i}`); await r.set({ siteId: companyId, name: `m${i}`, status: 'active', createdAt: ts(startIdx + i), ...extra(i) }); refs.push(r); }
  return refs;
}

describe('server-side plan limits', () => {
  it('works end to end', async () => {
  await reset(); await seedCompany('A');
  // Starter = 15 machines. Create 17 in order, run the trigger for each (in creation order).
  const refs = await addMachines('A', 17);
  const results = [];
  for (const r of refs) results.push(await enf.enforceCountLimit('machines', await r.get()));
  ok(results.slice(0, 15).every((x) => x.action === 'ok'), 'first 15 machines are allowed');
  ok(results[15].action === 'removed' && results[16].action === 'removed', 'machines #16 and #17 are removed');
  ok((await db.collection('machines').get()).size === 15, 'exactly 15 machines remain');
  const v = await db.collection('planLimitViolations').get();
  ok(v.size === 2 && v.docs[0].data().data.siteId === 'A', 'violations are logged with a copy of the record');

  // Concurrent triggers: all docs exist first, triggers run in REVERSE order -> still only the newest are removed.
  await reset(); await seedCompany('B');
  const refsB = await addMachines('B', 17);
  const snaps = await Promise.all(refsB.map((r) => r.get()));
  await Promise.all([...snaps].reverse().map((s) => enf.enforceCountLimit('machines', s)));
  const left = (await db.collection('machines').get()).docs.map((d) => d.id).sort();
  ok(left.length === 15 && !left.includes('m15') && !left.includes('m16'), 'parallel triggers keep the oldest 15, remove the newest 2');

  // Scrapped machines do not use a slot
  await reset(); await seedCompany('C');
  await addMachines('C', 15, 0, (i) => (i < 5 ? {status: 'scrapped'} : {}));
  const extra = db.collection('machines').doc('mx'); await extra.set({siteId: 'C', status: 'active', createdAt: ts(50)});
  const r1 = await enf.enforceCountLimit('machines', await extra.get());
  ok(r1.action === 'ok', 'a machine is allowed when 5 of the 15 existing ones are scrapped');
  const scrappedNew = db.collection('machines').doc('ms'); await scrappedNew.set({siteId: 'C', status: 'scrapped', createdAt: ts(60)});
  ok((await enf.enforceCountLimit('machines', await scrappedNew.get())).action === 'skipped', 'a record created as scrapped is not counted');

  // Ties (same createdAt, like one batch) are ranked by document id
  await reset(); await seedCompany('D');
  const tie = Timestamp.fromMillis(T0);
  for (let i = 0; i < 17; i++) await db.collection('machines').doc(`t${String(i).padStart(2, '0')}`).set({siteId: 'D', status: 'active', createdAt: tie});
  const tieSnaps = await db.collection('machines').get();
  const tieRes = await Promise.all(tieSnaps.docs.map((s) => enf.enforceCountLimit('machines', s)));
  ok(tieRes.filter((x) => x.action === 'removed').length === 2, 'batch-created records (same timestamp): exactly 2 of 17 removed');

  // Unlimited plan, trial = Starter, override, log-only mode, no createdAt
  await reset(); await seedCompany('E', {plan: 'enterprise'});
  await addMachines('E', 20);
  ok((await enf.enforceCountLimit('machines', await db.collection('machines').doc('m19').get())).action === 'ok', 'Enterprise (unlimited) is never limited');
  await reset(); await seedCompany('F', {plan: 'factory', status: 'trial'});
  await addMachines('F', 16);
  ok((await enf.enforceCountLimit('machines', await db.collection('machines').doc('m15').get())).action === 'removed', 'a trial company is limited like Starter even if plan says Factory');
  await reset(); await seedCompany('G', {limitOverrides: {machines: 20}});
  await addMachines('G', 20);
  ok((await enf.enforceCountLimit('machines', await db.collection('machines').doc('m19').get())).action === 'ok', 'a per-company override raises the limit');
  await db.collection('machines').doc('m20').set({siteId: 'G', status: 'active', createdAt: ts(21)});
  ok((await enf.enforceCountLimit('machines', await db.collection('machines').doc('m20').get())).action === 'removed', '...and the next one past the override is removed');
  await reset(); await seedCompany('H');
  await db.collection('machines').doc('n1').set({siteId: 'H', status: 'active'});
  ok((await enf.enforceCountLimit('machines', await db.collection('machines').doc('n1').get())).action === 'skipped', 'a record without createdAt is left alone (fail open)');
  process.env.PLAN_LIMIT_ENFORCEMENT = 'log';
  await reset(); await seedCompany('I'); await addMachines('I', 16);
  const lg = await enf.enforceCountLimit('machines', await db.collection('machines').doc('m15').get());
  ok(lg.action === 'logged' && (await db.collection('machines').get()).size === 16, 'log mode records but removes nothing');
  process.env.PLAN_LIMIT_ENFORCEMENT = 'off';
  ok((await enf.enforceCountLimit('machines', await db.collection('machines').doc('m15').get())).action === 'skipped', 'off mode does nothing');
  delete process.env.PLAN_LIMIT_ENFORCEMENT;

  // PM schedules: only active/paused count (archived do not); inventory parts; plants (inactive free a slot)
  await reset(); await seedCompany('J');
  for (let i = 0; i < 30; i++) await db.collection('pm_schedules').doc(`p${i}`).set({companyId: 'J', status: i < 3 ? 'archived' : 'active', createdAt: ts(i)});
  await db.collection('pm_schedules').doc('pnew').set({companyId: 'J', status: 'active', createdAt: ts(100)});
  ok((await enf.enforceCountLimit('pmSchedules', await db.collection('pm_schedules').doc('pnew').get())).action === 'ok', 'PM schedules: 3 archived ones leave room for one more (30 limit)');
  await db.collection('pm_schedules').doc('pnew2').set({companyId: 'J', status: 'active', createdAt: ts(101)});
  await db.collection('pm_schedules').doc('pnew3').set({companyId: 'J', status: 'active', createdAt: ts(102)});
  ok((await enf.enforceCountLimit('pmSchedules', await db.collection('pm_schedules').doc('pnew2').get())).action === 'ok', 'PM schedules: second extra one fits');
  ok((await enf.enforceCountLimit('pmSchedules', await db.collection('pm_schedules').doc('pnew3').get())).action === 'ok', 'PM schedules: third extra one is the 30th and fits');
  await db.collection('pm_schedules').doc('pnew4').set({companyId: 'J', status: 'active', createdAt: ts(103)});
  ok((await enf.enforceCountLimit('pmSchedules', await db.collection('pm_schedules').doc('pnew4').get())).action === 'removed', 'PM schedules: the 31st is removed');
  await reset(); await seedCompany('K');
  for (let i = 0; i < 101; i++) await db.collection('inventoryParts').doc(`i${i}`).set({companyId: 'K', createdAt: ts(i)});
  ok((await enf.enforceCountLimit('inventoryParts', await db.collection('inventoryParts').doc('i99').get())).action === 'ok', 'inventory: 100th part is allowed (limit 100)');
  ok((await enf.enforceCountLimit('inventoryParts', await db.collection('inventoryParts').doc('i100').get())).action === 'removed', 'inventory: 101st part is removed');
  await reset(); await seedCompany('L');
  await db.collection('plants').doc('pl1').set({companyId: 'L', status: 'inactive', createdAt: ts(1)});
  await db.collection('plants').doc('pl2').set({companyId: 'L', status: 'active', createdAt: ts(2)});
  await db.collection('plants').doc('pl3').set({companyId: 'L', status: 'active', createdAt: ts(3)});
  ok((await enf.enforceCountLimit('plants', await db.collection('plants').doc('pl2').get())).action === 'ok', 'plants: first active plant is allowed (an inactive one does not count)');
  ok((await enf.enforceCountLimit('plants', await db.collection('plants').doc('pl3').get())).action === 'removed', 'plants: second active plant is removed (Starter = 1)');

  // Seats: Starter = 3 full, 10 light
  await reset(); await seedCompany('M');
  const mem = (id, role, status = 'active') => db.collection('companies/M/users').doc(id).set({id, role, status});
  await mem('u1', 'admin'); await mem('u2', 'technician'); await mem('u3', 'technician', 'inactive'); await mem('u4', 'trainee');
  const now = Date.now();
  const inv = async (id, role, created, extra = {}) => { await db.collection('companies/M/invitations').doc(id).set({id, role, status: 'pending', token: `tok_${id}`, createdAt: ts(created), expiresAt: Timestamp.fromMillis(now + 86400000), ...extra}); await db.collection('inviteTokens').doc(`tok_${id}`).set({id}); };
  await inv('i1', 'supervisor', 1); // full seat #3 (admin, technician, supervisor) -> allowed
  await inv('i2', 'supervisor', 2); // seat #4 -> removed
  await inv('i3', 'trainee', 3);    // light, fine
  await inv('i4', 'technician', 4, {expiresAt: Timestamp.fromMillis(now - 1000)}); // expired invite ignored when ranking others
  const out = [];
  for (const id of ['i1', 'i2', 'i3']) out.push((await enf.enforceSeatLimit('M', await db.collection('companies/M/invitations').doc(id).get())).action);
  ok(out.join() === 'ok,removed,ok', `seats: ${out.join()} (inactive user and expired invite take no seat)`);
  ok(!(await db.collection('inviteTokens').doc('tok_i2').get()).exists && (await db.collection('inviteTokens').doc('tok_i1').get()).exists, 'a removed invitation also loses its link token');
  });
});

describe('AI credits', () => {
  it('charges a web-research request 6 credits, refuses past the monthly allowance and refunds on failure', async () => {
    const snap = await db.collection('aiUsage').get(); await Promise.all(snap.docs.map((d) => d.ref.delete()));
    const now = new Date('2026-10-19T10:00:00Z');
    const who = { uid: 'u1', companyId: 'AI1' };
    await ai.consumeAiQuota(db, who, now, 10, 1);      // normal suggestion: 1
    await ai.consumeAiQuota(db, who, now, 10, 6);      // with web research: 6 -> 7 of 10
    await assert.rejects(ai.consumeAiQuota(db, who, now, 10, 6), /AI credits/); // 7 + 6 > 10
    await ai.consumeAiQuota(db, who, now, 10, 3);      // exactly 10 of 10
    await assert.rejects(ai.consumeAiQuota(db, who, now, 10, 1), /AI credits/);
    await ai.refundAiCredits(db, who, now, 6);         // provider failed: 6 come back
    await ai.consumeAiQuota(db, who, now, 10, 1);
    const month = await db.collection('aiUsage').doc('company_AI1_m_2026-10').get();
    assert.equal(month.get('count'), 5);
  });
});
