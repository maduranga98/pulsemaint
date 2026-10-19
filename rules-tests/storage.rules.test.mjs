// Storage security-rules tests (see firestore.rules.test.mjs for how to run).
import { readFileSync } from 'node:fs';
import { before, after, describe, it } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-firmicore',
    storage: { rules: readFileSync(process.env.STORAGE_RULES_PATH ?? new URL('../storage.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

const member = (company) => env.authenticatedContext(`u-${company}`, { companyId: company }).storage();
const anon = () => env.authenticatedContext('anon', { firebase: { sign_in_provider: 'anonymous' } }).storage();
const png = { contentType: 'image/png' };
const bytes = () => new Uint8Array([1, 2, 3]);
let n = 0;
const fresh = (base) => `${base}${++n}.png`;

describe('tenant isolation', () => {
  it('members read/write their own company only; anonymous and strangers cannot', async () => {
    const p = fresh('workorders/A/wo1/documents/');
    await assertSucceeds(uploadBytes(ref(member('A'), p), bytes(), png));
    await assertSucceeds(getBytes(ref(member('A'), p)));
    await assertFails(getBytes(ref(member('B'), p)));
    await assertFails(uploadBytes(ref(member('B'), fresh('workorders/A/wo1/documents/')), bytes(), png));
    await assertFails(getBytes(ref(anon(), p)));
    await assertFails(uploadBytes(ref(anon(), fresh('companies/A/machines/m1/photos/')), bytes(), png));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), p)));
  });
  it('superadmin (platform staff) can read any company', async () => {
    const p = fresh('breakdowns/A/t1/media/');
    await assertSucceeds(uploadBytes(ref(member('A'), p), bytes(), png));
    await assertSucceeds(getBytes(ref(env.authenticatedContext('root', { superadmin: true }).storage(), p)));
  });
  it('legacy top-level folders stay closed', async () => {
    await assertFails(uploadBytes(ref(member('A'), fresh('contractors/c1/')), bytes(), png));
    await assertFails(uploadBytes(ref(member('A'), fresh('inventoryParts/p1/')), bytes(), png));
  });
  it('contractor safety submissions are never client-writable', async () => {
    await assertFails(uploadBytes(ref(member('A'), fresh('safetyTrainingSubmissions/A/i1/attempt-1/')), bytes(), png));
  });
});

describe('evidence is create-only', () => {
  const paths = [
    'workorders/A/wo1/completion/photos/',
    'workorders/A/wo1/approval-requests/',
    'breakdowns/A/t1/media/',
    'audit_attachments/A/s1/photo/',
    'audit_reports/A/',
    'audits/A/a1/i1/',
    'kaizen/A/c1/',
    'evaluation_attachments/A/e1/',
    'triage/A/reference/',
    'companies/A/staff_requests/r1/',
    'companies/A/purchaseOrders/po1/invoice/',
    'companies/A/training/offboard-reports/a1/',
    'companies/A/trainee-programmes/certificates/',
  ];
  for (const base of paths) {
    it(`${base} can be uploaded once, never overwritten or deleted`, async () => {
      const p = fresh(base);
      await assertSucceeds(uploadBytes(ref(member('A'), p), bytes(), png));
      await assertFails(uploadBytes(ref(member('A'), p), bytes(), png));
      await assertFails(deleteObject(ref(member('A'), p)));
    });
  }
  it('shared triage pdf/media folders are upload-only for any signed-in user', async () => {
    const p = fresh('triage/pdfs/');
    await assertSucceeds(uploadBytes(ref(member('A'), p), bytes(), { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(member('B'), p), bytes(), { contentType: 'application/pdf' }));
    await assertFails(deleteObject(ref(member('B'), p)));
    await assertFails(uploadBytes(ref(anon(), fresh('triage/media/')), bytes(), png));
  });
});

describe('mutable company assets keep working', () => {
  it('logos can be replaced and training/content-library files deleted by members', async () => {
    const logo = ref(member('A'), 'companies/A/branding/logo.png');
    await assertSucceeds(uploadBytes(logo, bytes(), png));
    await assertSucceeds(uploadBytes(logo, bytes(), png));
    const content = ref(member('A'), fresh('companies/A/content/'));
    await assertSucceeds(uploadBytes(content, bytes(), png));
    await assertSucceeds(deleteObject(content));
    await assertFails(deleteObject(ref(member('B'), 'companies/A/branding/logo.png')));
  });
});

describe('upload content checks', () => {
  it('active-content types are rejected, normal documents accepted', async () => {
    for (const bad of ['text/html', 'image/svg+xml', 'application/javascript', 'application/xhtml+xml', 'text/xml', 'TEXT/HTML']) {
      await assertFails(uploadBytes(ref(member('A'), fresh('workorders/A/wo9/documents/')), bytes(), { contentType: bad }));
      await assertFails(uploadBytes(ref(member('A'), fresh('companies/A/machines/m1/documents/')), bytes(), { contentType: bad }));
    }
    for (const ok of ['application/pdf', 'image/jpeg', 'video/mp4', 'audio/webm', 'application/octet-stream', 'image/vnd.dwg',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/zip']) {
      await assertSucceeds(uploadBytes(ref(member('A'), fresh('workorders/A/wo9/completion/cad/')), bytes(), { contentType: ok }));
    }
  });
  it('size caps still apply', async () => {
    await assertFails(uploadBytes(ref(member('A'), fresh('workorders/A/wo9/documents/')), new Uint8Array(51 * 1024 * 1024), png));
    await assertSucceeds(uploadBytes(ref(member('A'), fresh('companies/A/training-content/')), new Uint8Array(60 * 1024 * 1024), { contentType: 'video/mp4' }));
  });
});

describe('outsourced maintenance invoices', () => {
  const base = 'companies/A/machineOutsourced/m1/';
  it('members of the company upload PDFs and photos and read them back; others cannot', async () => {
    const pdf = ref(member('A'), `${base}${++n}_invoice.pdf`);
    await assertSucceeds(uploadBytes(pdf, bytes(), { contentType: 'application/pdf' }));
    await assertSucceeds(getBytes(pdf));
    await assertSucceeds(uploadBytes(ref(member('A'), `${base}${++n}_bill.jpg`), bytes(), { contentType: 'image/jpeg' }));
    await assertFails(getBytes(ref(member('B'), pdf.fullPath)));
    await assertFails(uploadBytes(ref(member('B'), `${base}${++n}_x.pdf`), bytes(), { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(anon(), `${base}${++n}_x.pdf`), bytes(), { contentType: 'application/pdf' }));
  });
  it('active content is refused and a deleted job can remove its files', async () => {
    await assertFails(uploadBytes(ref(member('A'), `${base}${++n}_x.html`), bytes(), { contentType: 'text/html' }));
    const f = ref(member('A'), `${base}${++n}_gone.pdf`);
    await assertSucceeds(uploadBytes(f, bytes(), { contentType: 'application/pdf' }));
    await assertSucceeds(deleteObject(f));
    await assertFails(deleteObject(ref(member('B'), `${base}${++n}_x.pdf`)));
  });
});
