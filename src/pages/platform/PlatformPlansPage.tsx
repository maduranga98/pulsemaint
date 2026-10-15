import { AddOnsTable, EnterprisePlansTable, LockedFeaturesTable, PlanLimitsTable } from '@/components/billing/PlanComparisonTables';
import { PageHeader } from './platformUi';

/** Every plan, its limits and locks, the sized Enterprise plans and the add-on rates — one reference page for Lumora staff. */
export default function PlatformPlansPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Plans" subtitle="What each plan includes, as enforced in the app. Enterprise plans are sized and priced per customer." />
      <PlanLimitsTable />
      <LockedFeaturesTable />
      <EnterprisePlansTable />
      <AddOnsTable />
    </div>
  );
}
