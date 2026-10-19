#!/usr/bin/env node
/**
 * One-off: the free trial is 7 days, but companies that registered or were
 * approved before that change still carry a longer `trialEndsAt` (e.g. 14 days).
 * This lowers every running trial to 7 days from its start (approvedAt, else
 * createdAt). It only ever shortens a trial, and leaves alone:
 *   - companies with a Stripe subscription or a plan set by the platform,
 *   - companies not in `trial` status,
 *   - trials whose 7 days from start have already passed (capping them would
 *     lock the customer out today) — listed so you can decide by hand.
 * Trials a superadmin deliberately extended also fall under the cap; use
 * --skip <companyId> (repeatable) to leave those alone.
 *
 * Safe to re-run. Dry run by default.
 *
 * Usage:
 *   node seed/capTrialsTo7Days.mjs [--apply] [--skip <companyId> ...]
 *
 * Credentials: firebase-admin application default credentials, e.g.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const TRIAL_DAYS = 7;
const DAY = 86_400_000;

const args = { apply: false, skip: new Set() };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--apply') args.apply = true;
  else if (argv[i] === '--skip') args.skip.add(argv[++i]);
  else { console.error(`Unknown argument: ${argv[i]}`); process.exit(1); }
}

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
const fmt = (n) => new Date(n).toISOString().slice(0, 10);

const snap = await db.collection('companies').where('status', '==', 'trial').get();
const now = Date.now();
let capped = 0;
for (const doc of snap.docs) {
  const c = doc.data();
  if (args.skip.has(doc.id) || c.stripeSubscriptionId || c.planSetBy === 'platform') continue;
  const end = ms(c.trialEndsAt);
  const start = ms(c.approvedAt) ?? ms(c.createdAt);
  if (end == null || start == null) continue;
  const target = start + TRIAL_DAYS * DAY;
  if (end <= target) continue;
  if (target < now) {
    console.log(`SKIP (7 days already passed) ${doc.id} ${c.name}: ends ${fmt(end)}, 7-day mark was ${fmt(target)}`);
    continue;
  }
  console.log(`${args.apply ? 'CAP' : 'would cap'} ${doc.id} ${c.name}: ${fmt(end)} -> ${fmt(target)}`);
  if (args.apply) await doc.ref.update({ trialEndsAt: Timestamp.fromMillis(target), updatedAt: FieldValue.serverTimestamp() });
  capped++;
}
console.log(`${args.apply ? 'Capped' : 'Would cap'} ${capped} trial(s).${args.apply ? '' : ' Re-run with --apply to write.'}`);
