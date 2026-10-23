# Backup and restore (cost-aware)

FirmiCore keeps its data in the Firestore database named `default` and in the default Cloud Storage bucket.
This runbook sets up recovery without letting backups grow the bill. **None of the commands below were run
from the repository session — they need the project owner's Google Cloud access. Check each flag with
`gcloud firestore ... --help` before use; the CLI changes between releases.**

## Layers (cheapest first)

| Layer | Covers | Cost driver | Setting |
| --- | --- | --- | --- |
| Point-in-time recovery (PITR) | Any second in the last 7 days (bad deploy, mass delete) | Extra storage for 7 days of changes | Enable once |
| Scheduled backups | A whole-database copy to restore from | GB stored × retention | Daily, keep 7 days; weekly, keep 8 weeks |
| Company export ZIP | One company's data, for the admin (and required before the one-year clean-up deletes anything) | Temporary — files are deleted after 2 days | Already built |
| Storage soft delete | An accidentally deleted file (photo, PDF) | Deleted bytes kept for the window | Keep the 7-day default |

Keep retention short: backup cost grows with *retention × database size*, so do not keep daily backups for months.
Approximate scale: a few GB of Firestore data costs cents per month; the Storage photos are the larger cost.

## One-time setup (project owner)

```bash
PROJECT=<firebase-project-id>

# 1. Point-in-time recovery (7 days)
gcloud firestore databases update --database=default --enable-pitr --project=$PROJECT

# 2. Scheduled backups: daily kept 7 days, weekly kept 8 weeks
gcloud firestore backups schedules create --database=default --recurrence=daily  --retention=7d  --project=$PROJECT
gcloud firestore backups schedules create --database=default --recurrence=weekly --day-of-week=SUN --retention=8w --project=$PROJECT
```

Console equivalent: Google Cloud console → Firestore → *Disaster recovery*.

### Budget alert (stops a surprise bill)
Google Cloud console → Billing → Budgets & alerts → create a budget for this project with alerts at 50 %, 90 %, 100 %.

### Storage lifecycle (optional, cheaper storage, no code)
Moves old attachments to a cheaper class and sweeps the temporary export ZIPs. The one-year record clean-up still deletes
record files itself (only after an export); do **not** add a delete rule for `workorders/` or `breakdowns/` here, or files
could disappear before the admin has exported them.

```json
{
  "rule": [
    {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
     "condition": {"age": 90, "matchesPrefix": ["workorders/", "breakdowns/"]}},
    {"action": {"type": "Delete"},
     "condition": {"age": 3, "matchesPrefix": ["companyExports/"]}}
  ]
}
```

```bash
gcloud storage buckets update gs://<bucket> --lifecycle-file=lifecycle.json
```

Nearline has a 30-day minimum storage charge and a small per-read fee; it suits files nobody opens after three months.

## Restoring

Always restore into a **new database** first, look at it, and copy back only what is needed. Restoring over `default` replaces live data.

### From a scheduled backup
```bash
gcloud firestore backups list --project=$PROJECT
gcloud firestore databases restore --source-backup=projects/$PROJECT/locations/nam5/backups/<id> \
  --destination-database=restored-$(date +%Y%m%d) --project=$PROJECT
```

### From point-in-time recovery (last 7 days)
Use the console (*Disaster recovery → Point-in-time recovery → Restore*) or export a snapshot with
`gcloud firestore export gs://<bucket>/pitr-<date> --snapshot-time=<RFC3339 time> --database=default`
and import it into a separate database.

### Copying a few records back
Read the wanted documents from `restored-…` with the Admin SDK and write them to `default` (use `set` with the same ids).
Delete the temporary database afterwards — it is billed until removed:
`gcloud firestore databases delete --database=restored-<date>`.

### Records the one-year clean-up deleted
Those were exported first (see `CLAUDE.md` → Data retention). Restore from the admin's export ZIP (`data/*.json` holds each list)
or, within the backup retention above, from a backup taken before the clean-up.

## Test it
Once a quarter restore the newest daily backup into a temporary database, open a few records, then delete it. An untested backup is not a backup.

## Storage limits
Storage is not limited per plan (see `CLAUDE.md`). To watch growth, use Cloud Monitoring → Storage → `Total bytes` for the bucket and the Firestore *Storage* chart, and keep the budget alert above.
