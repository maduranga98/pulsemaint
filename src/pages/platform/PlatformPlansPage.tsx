import { AddOnsTable, EnterprisePlansTable, LockedFeaturesTable, PlanLimitsTable } from '@/components/billing/PlanComparisonTables';
import { useSalesOnly } from '@/lib/platform/useSuperadmin';
import { PageHeader } from './platformUi';

/** Every plan, its limits and locks, the sized Enterprise plans and the add-on rates — one reference page for Lumora staff. */
export default function PlatformPlansPage() {
  // Sales managers see only what each plan includes: its limits and the features it unlocks.
  const { salesOnly } = useSalesOnly();
  return (
    <div className="space-y-6">
      <PageHeader title="Plans" subtitle={salesOnly ? 'Limits and features of each plan, as enforced in the app.' : 'What each plan includes, as enforced in the app. Enterprise plans are sized and priced per customer.'} />
      <PlanLimitsTable />
      <LockedFeaturesTable />
      {!salesOnly && <EnterprisePlansTable />}
      {!salesOnly && <AddOnsTable />}
    </div>
  );
}
