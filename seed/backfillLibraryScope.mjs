#!/usr/bin/env node
/**
 * One-off backfill: stamp `libraryScope: 'training'` on every
 * `trainingModules` document that is missing the field.
 *
 * Why: the two module libraries (the Training tab's and Trainee
 * Management's) are now told apart by a required `libraryScope` field, and
 * both library queries filter on it server-side. Documents created before
 * that field existed have no value for it, so they are invisible to both
 * libraries until this script runs. 'training' is the correct value — that
 * is how the old shared library behaved for those documents.
 *
 * Safe to re-run: it only touches documents where the field is absent, so a
 * second run reports 0 updates.
 *
 * Usage:
 *   node seed/backfillLibraryScope.mjs --company <companyId> [--dry-run]
 *
 *   --company   REQUIRED. Only documents belonging to this companyId are
 *               considered, so one tenant can be migrated at a time.
 *   --dry-run   Print the counts that would change and exit without writing.
 *
 * Credentials: uses firebase-admin's application default credentials, e.g.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_SCOPE = 'training';
const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { company: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--company') args.company = argv[++i] ?? null;
    else if (arg.startsWith('--company=')) args.company = arg.slice('--company='.length);
  }
  return args;
}

async function main() {
  const { company, dryRun } = parseArgs(process.argv.slice(2));

  if (!company) {
    console.error('Error: --company <companyId> is required.');
    console.error('Usage: node seed/backfillLibraryScope.mjs --company <companyId> [--dry-run]');
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  const snap = await db.collection('trainingModules').where('companyId', '==', company).get();

  const missing = snap.docs.filter((d) => {
    const scope = d.data().libraryScope;
    return scope !== 'training' && scope !== 'trainee_management';
  });

  console.log(`company:            ${company}`);
  console.log(`modules scanned:    ${snap.size}`);
  console.log(`already scoped:     ${snap.size - missing.length}`);
  console.log(`missing scope:      ${missing.length}`);

  if (missing.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (dryRun) {
    console.log(`\n--dry-run: would set libraryScope='${DEFAULT_SCOPE}' on ${missing.length} document(s).`);
    for (const doc of missing.slice(0, 20)) {
      console.log(`  ${doc.id}  ${doc.data().title ?? '(untitled)'}`);
    }
    if (missing.length > 20) console.log(`  … and ${missing.length - 20} more`);
    return;
  }

  let written = 0;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of missing.slice(i, i + BATCH_SIZE)) {
      batch.update(doc.ref, { libraryScope: DEFAULT_SCOPE });
    }
    await batch.commit();
    written += Math.min(BATCH_SIZE, missing.length - i);
    console.log(`updated ${written}/${missing.length}`);
  }

  console.log(`Done. Set libraryScope='${DEFAULT_SCOPE}' on ${written} document(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
