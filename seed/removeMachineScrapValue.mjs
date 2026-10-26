#!/usr/bin/env node
/**
 * One-off: the expected scrap value is no longer typed in; it is worked out from the purchase price and
 * expected lifespan (src/lib/machineAsset.ts). This deletes the old typed `scrapValue` field from every
 * machine. `scrapRecord` (the real sale amount of a machine that was scrapped) is left alone.
 *
 * Safe to re-run. Dry run by default.
 *
 * Usage:
 *   node seed/removeMachineScrapValue.mjs [--apply] [--company <companyId>]
 *
 * Credentials: firebase-admin application default credentials, e.g.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = { apply: false, company: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--apply') args.apply = true;
  else if (argv[i] === '--company') args.company = argv[++i];
  else { console.error(`Unknown argument: ${argv[i]}`); process.exit(1); }
}

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore('default');

let query = db.collection('machines');
if (args.company) query = query.where('siteId', '==', args.company);
const snap = await query.get();

const targets = snap.docs.filter((d) => Object.prototype.hasOwnProperty.call(d.data(), 'scrapValue'));
console.log(`${targets.length} of ${snap.size} machine(s) have a typed scrapValue.`);

if (args.apply) {
  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    for (const d of targets.slice(i, i + 400)) batch.update(d.ref, { scrapValue: FieldValue.delete() });
    await batch.commit();
  }
  console.log(`Removed scrapValue from ${targets.length} machine(s).`);
} else {
  console.log('Dry run. Re-run with --apply to delete the field.');
}
