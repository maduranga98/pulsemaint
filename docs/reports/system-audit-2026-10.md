# FirmiCore — system audit (faults, security, AI data risk, what works)

Date: 2026-10-23 · Method: static review of the repository (frontend, Cloud Functions, `firestore.rules`,
`storage.rules`, hosting config, CI), `npm audit`, targeted code searches, and the local test suites
(vitest 561 tests, rules tests 97, `tsc`, functions `eslint` — all passing). **Nothing was tested against the
live production system** (no credentials, no browser run of the deployed app). Findings marked *verify* need a check
in the Firebase / Google Cloud / Stripe consoles.

Severity: **High** = fix soon · **Medium** = plan it · **Low** = hygiene.

---

## 1. Summary

The backend is built carefully: all 46 callable functions and the Stripe webhook check who is calling
(`requireMember` / `requireOwnCompany` / `requireSuperadmin`, Stripe signature check), tenant data is isolated
by company, plant and (for work orders / breakdowns) department in `firestore.rules`, uploads are limited to
the company's own folders, reports escape user text before rendering PDFs, and the AI proxy only reads the
caller's own company records. There are no secrets in the repository.

The things that need attention are mostly **outside the application logic**:

1. A vulnerable copy of **DOMPurify** (the library that protects training lessons from XSS) — fixed in the accompanying PR.
2. **Users can plant `javascript:` links** in data other users click (notifications, attachments) — fixed in the PR (notification links) and guarded globally.
3. **No security headers** on the website (clickjacking, MIME sniffing …) — added in the PR (CSP still to do).
4. **CI does not type-check or run the unit tests** — added in the PR.
5. **No Firebase App Check**, **no MFA** for admins / platform staff, **no monitoring / backups visible** in the repo — recommendations below.
6. Known vulnerable dependencies without a safe upgrade (`xlsx`).

---

## 2. Security findings and how to fix them

### High

**H1 — DOMPurify 3.2.6 (critical advisory: XSS).** `sanitizeHtml()` uses it for every training lesson, which every
trainee opens. *Fix (done in PR):* upgraded to `^3.4.17`. Re-run `npm audit` after merging.

**H2 — `javascript:` URLs in stored data (stored XSS, needs a click).** React 18 does not block `javascript:` in
`href`. Attachment URLs and notification `linkTo` values are written by users and clicked by others (admin,
plant manager …); a notification's `linkTo` was also passed to `window.location.assign()` when the OS
notification was clicked. A member could therefore run script as an admin. *Fix (done in PR):*
`safeInternalPath()` / `safeExternalUrl()` helpers; the notification rule now only accepts `/…` in-app paths
(`firestore.rules`, tested); the bell and device notification only follow safe paths; a global click guard in
`main.tsx` refuses `javascript:` / `vbscript:` links anywhere. *Next:* run attachment URLs through
`safeExternalUrl()` where they are rendered, and move to a strict CSP (see M1).

**H3 — No web-app security headers.** Hosting sent only cache headers. Without `X-Frame-Options` the app could be
framed (clickjacking); without `nosniff` browsers may sniff content types. *Fix (done in PR):* `firebase.json` now
sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (camera/microphone
only for the app itself) and `Strict-Transport-Security`. *Next:* a Content-Security-Policy — see M1.

**H4 — CI passes without type-checking or unit tests.** The hosting workflows run `vite build` only
(no `tsc`), the rules workflow runs only the rules tests, the functions workflow only lint at deploy. So a green
check does **not** mean the 561 unit tests pass. *Fix (done in PR):* `.github/workflows/checks.yml` runs `tsc`,
`vitest` and the functions lint on every pull request. *Then:* in GitHub → Settings → Branches, make `checks`,
`rules_tests` and `build_and_preview` required before merging.

### Medium

**M1 — No Content-Security-Policy.** A strict CSP (no inline scripts, allow-list for Stripe, Google, Firebase)
would stop most XSS even if a bug slips through, and would block `javascript:` URLs outright. *Fix:* add it as
`Content-Security-Policy-Report-Only` first, collect violations for a week (add a `report-to` endpoint), then enforce.
Needs testing with Stripe Elements, Google Sign-In and the Firebase SDKs — do not enable blind.

**M2 — Any company member can create notifications for anyone (spoofing).** The create rule only checks the company and
that nothing is pre-read; `message`, `actorName`, `recipientRoles` and `recipientUserIds` are free. A member can
send an admin a convincing fake "system" message. *Fix:* create notifications from Cloud Functions only (or
constrain the fields in the rule: `actorUserId == auth.uid`, recipients limited to the sender's plant / role rules).

**M3 — The user roster is readable across plants (personal data).** `companies/{id}/users/*` can be read by admin,
supervisor, plant manager, HR, safety officer and store keeper with no plant check, so a supervisor of plant A sees
names, emails, phones, addresses and employee ids of plant B. *Fix:* add the plant condition to the read rule and move
pickers to the existing `listRequestRecipients`-style callables that return only name / role / department.

**M4 — Public QR endpoints can be bypassed by rotating addresses, and have no bot protection.** The rate limiter
keys on the first `X-Forwarded-For` hop, which the caller can set; the per-machine cap (30 reports/hour) still
bounds the damage. *Fix:* enable **Firebase App Check** (reCAPTCHA Enterprise / v3) for callables, use the right-most
trusted hop for the IP (*verify* what Cloud Run puts last in your logs), and consider a challenge on the public form.

**M5 — Vulnerable dependencies (`npm audit`).**
- `xlsx` (high: prototype pollution, ReDoS) — used to read user-uploaded Excel in inventory and user import; no fix on
  npm. *Fix:* replace with SheetJS' own 0.20.x build (installed from `cdn.sheetjs.com`) or `exceljs`; until then keep
  imports to trusted admins (they already are) and keep the file-size caps.
- `firebase` / `@grpc/grpc-js` (high) — Node-side gRPC issues; the browser build does not use `grpc-js`. Low real exposure; update
  `firebase` when the advisory fix is released.
- `react-router` (moderate: open redirect via backslash). *Fix:* upgrade to the patched 6.x / 7.x when compatible.
- Functions: `nodemailer` (high: only with the `raw` option, which the code does not use), `puppeteer-core` chain
  (extract-zip / basic-ftp; used with a fixed Chromium, no user URLs), `firebase-admin` chain (moderate). *Fix:* `npm audit fix`
  in `functions/` and test emails and PDFs.

**M6 — No MFA / no extra protection for the highest-privilege accounts.** Platform superadmin is granted by a verified email
on an allow-list (good), but a stolen password alone is enough. *Fix:* turn on Firebase Authentication multi-factor (TOTP / SMS)
and require it for superadmin and company admins; use security keys for Lumora staff.

**M7 — No monitoring, error tracking or backups visible.** *Verify and fix:* enable Firestore point-in-time recovery and a daily
scheduled backup, a budget alert, Cloud Monitoring alerts for function errors, and a frontend error tracker (Sentry or similar).

### Low

- `functions/.env` is committed. It holds only price ids, the public Stripe publishable key and two email addresses
  (superadmin allow-list, alert address) — no secrets (those are in Secret Manager). Consider moving the e-mails to a secret.
- Anonymous sign-in: the app no longer uses it. *Verify:* Firebase console → Authentication → Sign-in method → **Anonymous = Disabled**; delete
  the old anonymous users.
- Invitation documents can be read by anyone who knows both the company id and the (unguessable) invitation id; tokens are
  32 random characters and invitations are now deleted after 3 days. Acceptable.
- The AI proxy returns the provider's error text to the browser (e.g. "credit balance too low"). Harmless, but show a generic message to non-admins.
- `claudeJson` accepts a free prompt from any signed-in member (capped, quota-limited per user and company). See section 4.
- Sessions and password reset rely on Firebase defaults (good); minimum password length is 8 — raise to 10–12 and block common passwords.

---

## 3. Functional faults and gaps (not security)

Fixed during this work: machine form prefilled with the previous step's values, guided tour from Help skipping steps, closed
breakdowns hidden from plant managers, bugs not separated in the platform console, floor-operator breakdown list, plant
manager unable to see all plant users when creating a work order, one user blocked from any second job (now time-slot based).

Still open or approximate:

| Area | Gap | Suggested fix |
|---|---|---|
| Retention | The 90-day view window for store keeper / safety / HR / supervisor is **not implemented**; audits and Storage attachments are never cleared | Decide view-window vs deletion; add attachment clean-up with a dry run first |
| Module switches | Client-side only: the server still runs triggers/callables of a switched-off module | Check `disabledModules` in each module's callables |
| Time-slot assignment | Client-side check only; unscheduled work orders claim no time | Re-check in a callable when assigning |
| Departments & shifts | Plant-scoped, so a company with no plants cannot set them up | Allow company-wide (plant-less) departments |
| Floor-operator "new users see no breakdowns" | Cause not reproduced in production; hardened (re-subscribe, visible error) | Send the on-screen error if it still happens |
| Click sound in Inventory | Only the notification chime exists in the app; made it fire only for genuinely new notifications | Report the exact page if it persists |
| Orphaned modules | `tpm` and `fives` are built but not reachable | Delete or wire them |
| Role/nav drift | Nav vs route access can differ (`NAV_ITEMS` vs `ProtectedRoute`) | One shared access table |
| Tests | No end-to-end (browser) tests; UI verified only through manual use | Add Playwright smoke tests for login, add machine, report breakdown |
| Codex review | Fails on every PR (usage limit) | Renew plan or rely on `checks` CI |

---

## 4. Can data leak to the AI, or can hackers (or AI) break in?

### What is sent to the AI (Anthropic Claude)
- Only through the `claudeJson` Cloud Function (key in Secret Manager, never in the browser).
- Content: the text the user is working on (fault description, audit finding, text to translate) plus, for breakdown
  suggestions, up to 14 of **the caller's own company's** past root-cause records (descriptions, causes, fixes, machine names, work order / ticket numbers).
- Scoping: filtered by the caller's company, then plant, then (for technician, trainee, supervisor, floor operator) department. Other companies' data cannot reach a prompt.
- Not sent: users' emails / phones / addresses, costs, documents, photos, passwords, billing data.
- **Residual risks:** (1) free text typed by staff may contain a person's name or phone number; (2) the provider (Anthropic) receives it
  — *verify* in your Anthropic account that data retention / training settings match your policy (API data is not used for training by default
  under commercial terms; confirm for your account and consider zero-data-retention); (3) record text is untrusted — see prompt injection.
- **Fixes:** tell staff not to put personal data in fault text (one line on the form); strip emails / phone numbers from the prompt
  server-side before sending; keep the per-user and per-company quotas; add a company setting to switch AI off.

### Prompt injection ("AI attacking via text")
A member could write instructions into a root-cause field ("ignore previous instructions …"); that text is later pasted into
another user's prompt. The AI has **no tools and no access to data beyond the prompt**, and answers are shown as suggestions in a fixed JSON shape,
so the worst outcome is misleading advice, not data theft. *Fix:* wrap history in a clearly marked "data, not instructions" block, tell the model so,
cap each line (already clipped to 300 characters), and show "AI suggestion — verify before acting" on screen.

### Can a hacker get in?
Realistic routes and the state of defences:

| Route | Defence today | Remaining gap |
|---|---|---|
| Read another company's data | Firestore / Storage rules by company, plant, department; callables check membership; rules tests (97) | M3 roster across plants |
| Become admin / change a role | Roles can only change via Lumora's superadmin callable; self-edits blocked in rules | MFA (M6) |
| Take over the platform console | Verified-email allow-list + custom claim | MFA, keep the list small |
| XSS (script in the browser) | DOMPurify for rich text, React escaping elsewhere, PDF reports escape text | H1/H2 fixed in PR; CSP (M1) |
| Spam the public QR form | Rate limits per address / machine, length caps, no storage writes | App Check, address spoofing (M4) |
| Steal the AI key or Stripe key | Secret Manager; webhook signature check | Rotate keys periodically, restrict IAM roles |
| Supply chain (npm) | Lock file | `npm audit` in CI, Dependabot, the `xlsx` replacement |
| Insider (a member abusing access) | Roles, audit log, deleted-user removal | Notification spoofing (M2), `javascript:` links (H2, fixed) |
| Automated / AI-driven attacks | Quotas, rate limits, Firebase Auth throttling | App Check, WAF/Cloud Armor if traffic grows |

No evidence of an exploitable hole that lets an outsider read data without signing in was found; the open items above need an
authenticated member or an unpatched library.

---

## 5. What is working (inventory)

- **Core maintenance:** machines (register, bulk CSV import, QR labels, health score, documents, spare parts, scrap/decommission), breakdowns
  (public QR report, in-app report, assign / attend / close, severity rules), work orders (create, assign by time slot, execute, sign-off with manual RCA), PM schedules and PM work orders, RCA records.
- **Inventory:** parts catalog, stock movements, requests, issue and receive, returns, suppliers, purchase orders with supplier e-mail, Excel import, low-stock alerts.
- **People:** users and roles, invitations (3-day expiry), shifts and handovers, training modules / assignments / certificates / trainee programmes, evaluations, contractors and their safety training and safety cards, work permits and safety cases.
- **Insight:** dashboards per role, analytics, MOE, reports (PDF / Excel / scheduled), audits, Kaizen.
- **Platform (Lumora):** companies, approvals, plans and limits, module switches, Stripe billing, cancellations, leads / sales pipeline, feature requests and bugs, to-dos, expenses.
- **Data handling:** company export (ZIP per record), retention job (1 year), notifications (delete when read, send once), department / plant isolation, user deletion.

---

## 6. Action list for the owner

1. Merge the accompanying PR after the three checks are green; then make `checks`, `rules_tests`, `build_and_preview` required.
2. Firebase console: disable Anonymous sign-in; enable MFA; turn on Firestore backups / PITR; set up alerts.
3. Enable **App Check** for web + callables (reCAPTCHA Enterprise), test, then enforce.
4. Decide on the user-roster plant rule (M3) and notification creation (M2).
5. Plan the CSP rollout (report-only first) and the `xlsx` replacement.
6. Confirm Anthropic data-retention settings and add the "no personal data in fault text" note.
7. Run `npm audit` in `/` and `/functions` monthly (or add Dependabot).
