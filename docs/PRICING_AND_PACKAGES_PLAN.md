# FirmiCore pricing, limits and rollout plan (proposal — not implemented)

> **Update 2026-10-16 (v5 — no storage quota: files stay online 12/18/24 months then are exported as a ZIP for the admin, see `docs/DATA_ARCHIVE_AND_EXPORT_PLAN.md`; Enterprise is a custom quote, nothing unlimited, see the last two pages of the PDF):** prices and limits below were revised after comparing MaintenancePro, FixAhead, MaintainX, UpKeep, Limble, Fiix, Hippo, eMaint, Atlas and local listings. The authoritative chart is `docs/FirmiCore-Pricing-Chart.pdf` (Starter $25, Growth $89, Factory $379, Enterprise from $1,499; light users 10/50/250; storage 5/50/500 GB; adds limits on inventory parts, POs, breakdown reports, PM schedules, contractors, training modules and scheduled reports). Where this file differs, the PDF wins; phases in §4 still apply.

Status: **proposal for approval.** No code has been changed. Prices are USD per company per month.
Unit costs marked (v) were checked against Google/Anthropic pricing pages via search; (a) are assumptions to be measured (see §6).

## 1. What costs money (from reading the code)

| Driver | Evidence in repo | Unit cost |
|---|---|---|
| AI | `functions/src/ai/claudeJson.js`: `claude-sonnet-5`, optional web search (≤3/call). Caps are only 40/user/hour and 500/company/day, not tied to plan. | Sonnet 5 $2/$10 per MTok (v); web search $10/1,000 (v). Plain call ≈ $0.02 (a), web call ≈ $0.12 (a) |
| Firestore reads | 215 `onSnapshot`, 124 `getDocs`; dashboards compute client-side from full history | nam5 reads $0.06/100k (v). ≈ $0.26/user/month at 20k reads/day (a) |
| Storage | Evidence is create-only and never deleted; no compression on WO/breakdown photos; no per-company quota | $0.026/GB-month (v); download ≈ $0.15/GB (a) |
| Functions | 41 document triggers, 17 schedules, 42 callables; PDF via 2 GiB puppeteer | cents/company → fixed ≈ $1–5 |
| Email | one shared SMTP mailbox for all companies | flat, unmetered |
| SMS / WhatsApp | channel names exist, no provider integration found | none today; meter if added |
| Stripe | ~3.4% + $0.30 | hurts the lowest plan most |

Finding: **users (reads + AI) cost more than storage**, but storage compounds forever. Price by seats + AI credits + storage, not machines.

## 2. Packages

Plan ids stay `starter | workshop | factory | enterprise` (no data migration); only labels change (workshop → "Growth").

Seat types: **Full** = admin, plant_manager, supervisor, technician, store_keeper, hr_officer, safety_officer. **Light** = floor_operator, trainee.
AI credit: plain call = 1, web-search call = 6.

| | Starter | Growth (`workshop`) | Factory | Enterprise |
|---|---|---|---|---|
| Monthly | $39 | $99 | $349 | **from $1,499** (annual contract) |
| Yearly (2 months free) | $390 | $990 | $3,490 | contract |
| Machines | 15 | 75 | 400 | **unlimited** |
| Full / light users | 3 / 5 | 10 / 20 | 40 / 100 | **unlimited** |
| Work orders / month | 60 | 400 | 2,500 | **unlimited** |
| PM schedules, parts | 15 / 50 | unlimited | unlimited | **unlimited** |
| Storage | 3 GB | 40 GB | 250 GB | **unlimited** (fair-use alert at 2 TB) |
| Max file | 15 MB, no video | 50 MB | 100 MB (video 200 MB) | **largest the platform allows** |
| AI credits / month | 20 | 150 | 800 | **unlimited** (fair-use alert at 5,000) |
| Dashboard lookback | 6 mo | 24 mo | 60 mo | **all** |
| Contractor safety invites / month | 0 | 30 | 300 | **unlimited** |
| Modules | core | + contractors, shift handover, training, safety, auto-PO, low-stock | + MOE, audits, kaizen | **every module and flag, multi-plant** |

Records are never deleted; lookback only limits what dashboards load. At a storage cap, new uploads are blocked until the admin buys more.

Add-ons (≥3× cost): +50 GB $6 · extra full user $9 · extra light user $2 · 500 AI credits $25.
Trial (14 days): everything except multi-plant, 1 GB, 20 credits, Starter user counts.

### Enterprise = custom quote, nothing unlimited
- All modules available (including multi-plant), but **every limit and the price are set per contract**. The PDF's last two pages hold the unit-price table, sizing formulas, three worked quotes and the quoting rules (minimum $1,000/month, annual contract, prepay −15%, overage 1.5×, no "unlimited" line).
- Implementation: Enterprise plan config stores per-company numeric limits on the company document (set by superadmin in the platform console) instead of `null`; `planLimitsFor` must read those overrides. Lumora sets the plan manually and invoices outside self-serve Stripe.
- Worked margins: quote A (60 full + 200 light users, 600 machines) $2,253/mo, ≈ 90% (86% stress); quote B (3 plants, 150 full users) $5,549/mo, ≈ 87% (77% stress).
- Listed Enterprise items that **do not exist in code**: SSO/SAML, public API/integrations, SLA support — quote only as scoped paid development. TPM/5S (`src/modules/tpm`, `fives`) are built but not routed.

### Margins at full use (cost model, see §6)
| | Typical reads | Reads ×3 |
|---|---|---|
| Starter | 89% | 84% |
| Growth | 86% | 79% |
| Factory | 84% | 75% |
| Enterprise (at fair-use thresholds) | 78% | 64% |

## 3. Pre-decided defaults for the open questions

| Question | Default (change if you disagree) |
|---|---|
| Unverified unit costs | Launch with the assumed numbers, **measure for 2 weeks** (§6). Rule: if real reads/active user/day > 40k → shorten lookback or raise price; if AI cost/call > $0.04 → move plain calls to Haiku 5.5. |
| AI per-call cost | Log `response.usage` and computed cost per call into `aiUsage`; shift translation + RCA suggestions to `claude-haiku-5-5` ($0.10/$0.50 — ~20× cheaper) after a quality check; keep Sonnet 5 for web research only. |
| Enterprise SSO/API | Not sold until built. Enterprise sold on the modules that exist. |
| Storage enforcement | Phase 1 soft (client check + usage meter). Phase 2 hard: `storageFull` custom claim read by `storage.rules` (claims are already managed in `functions/src/auth/companyClaim.js`; merge, never replace). |
| Existing paying customers | Grandfather 12 months on the old limits/price via `company.planVersion` (`undefined` = v1). **Keep the old Stripe price IDs in `PRICE_IDS`** or `isFirmicoreInvoice` / `planAndCycleForPrice` stop recognising their invoices. |
| Churned/expired trials | Read-only + export 90 days, then purge (reuse `platformDeleteCompany` logic). Needs a terms notice; irreversible — your call. |
| Add-ons | Phase 5; until then superadmin adds them manually as Stripe invoice items. |
| Currency | USD list at launch; pilot LKR/INR pricing with a few prospects (no South-Asia CMMS price data was found). |

## 4. Implementation plan (branch → PR into `main`, per CLAUDE.md)

**Phase 0 — measure & decide (no code, 1–2 days).** Enable Cloud Billing export to BigQuery; read Firestore `document/read_count`, Storage `total_bytes`, Anthropic usage; confirm prices; write terms (fair use, purge, grandfathering).

**Phase 1 — plan config & gating (≈3–4 days).**
- `src/lib/planLimits.ts`: add `fullUsers`, `lightUsers`, `storageBytes`, `maxFileBytes`, `aiCredits`, `lookbackMonths`, `contractorInvites`; version map keyed by `planVersion`; Enterprise all `null`/true.
- `functions/src/lib/planFeatures.js`: mirror (keep in sync, as the comment demands).
- Seat counting: `usePlanLimitCheck` users → count by role (`where('role','in',[…])`; may need an index in `firestore.indexes.json`); `UsersPage` and `UsersBulkImportModal` use it.
- `BillingPage.tsx` + locale keys; `PLAN_PRICES` in `functions/src/platform/platformAccess.js`; `stripeClient.js` + `.env.example` new `STRIPE_PRICE_*` vars (old ones kept).
- Update `src/lib/__tests__/planFeatures.test.ts`; add tests for seat split and Enterprise unlimited.

**Phase 2 — AI metering (≈2 days).** `aiUsageLimit.js`: monthly per-company credit counter by plan (server-side, authoritative), web-search = 6 credits; usage + cost log; model routing flag; Enterprise alert at 5,000.

**Phase 3 — storage metering (≈4–5 days).** `onObjectFinalized`/`onObjectDeleted` functions maintain `companies/{id}.storageBytes` (resolve company from the path root: company id, or plant id via `plants`); one-off backfill script; central `checkUpload(file)` helper used by the ~30 upload sites (size cap by plan, quota check); usage meter on Billing; `firestore.rules`: clients must not write usage fields. Phase 3b: `storageFull` claim for hard enforcement.

**Phase 4 — cost reduction (≈3–4 days, can run in parallel).** Client-side image compression for WO/breakdown photos (reuse `src/lib/safety/attachmentUtils.ts`); GCS lifecycle rule to a colder class after 365 days; fill `analytics_monthly/daily` so dashboards stop scanning history; apply `lookbackMonths` clamp in analytics services.

**Phase 5 — lifecycle & add-ons (≈3 days).** Churn purge job, export before purge, Stripe subscription items for add-ons, cost-per-company view in the platform console (storage, AI credits, estimated reads) so margin is visible.

**Rollout.** Ship behind `planVersion`; new sign-ups get v2 immediately; existing customers stay v1 for 12 months with an email 60 days before the switch; Starter/Growth/Factory prices apply at renewal.

**Risks.** Storage rules cannot read plans (hence claim/soft limit); old price IDs must stay mapped; seat split changes what "users" means in the UI; Haiku quality must be checked before routing; aggressive lookback may surprise managers — show a clear "older data hidden, upgrade or export" message.

## 5. Competitor reference (third-party sources, verify before quoting)
MaintainX ~$20 / $65 per user; Fiix ~$45 / $75; UpKeep ~$24 / $55; Limble ~$28+. A 10-person plant pays ~$200–450/month elsewhere.

## 6. Cost model
Costs per month = storage (GB × $0.026) + download (4% of stored × $0.15/GB) + reads ((full × 20k + light × 4k) × 22 days × $0.06/100k) + AI (credits × $0.02) + fixed ($1–10) + Stripe (3.4% + $0.30). Assumptions to measure: 20k reads/full user/day, 4k/light user/day, 16 MB per work order, 10 MB per breakdown, $0.02 per plain AI call.
