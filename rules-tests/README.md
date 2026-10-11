# Security-rules tests

Tests for `firestore.rules` and `storage.rules`, run against the Firebase emulators with Node's built-in test runner (kept out of the root `npm test`, which needs no emulator).

```bash
cd rules-tests
npm install
npm test        # starts the Firestore + Storage emulators, runs *.test.mjs, shuts down
```

Requires Java 17+ (for the emulators). Run the suite against any other rules file with
`FIRESTORE_RULES_PATH=/path/to/rules npm test` or `STORAGE_RULES_PATH=…`.

What is covered:

- **Privilege escalation** — a user cannot change their own role/company/plant/department, re-activate themselves, or create a profile/mapping outside company registration or a valid pending invitation.
- **Tenant isolation** — admins, supervisors, technicians of one company cannot read, update, delete or create another company's work orders, breakdown tickets, machines, LOTO permits, condition readings, machine history, MOE data and settings. The queries the app actually runs (by `siteId`, `companyId`, `machineId`, `workOrderId`) are tested.
- **Flows that must keep working** — company registration, invitation acceptance, login mapping sync, assigned-technician updates, QR (anonymous) breakdown report and machine lookup.
- **Storage** — company isolation, create-only evidence, active-content types rejected, size caps.

When you add a collection or Storage path, add a matching case here.
