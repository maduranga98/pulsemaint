import { MoeDashboard } from '../components/MoeDashboard';
import { PlanFeatureGate } from '../../../components/settings/PlanFeatureGate';

export function MoePage() {
  return (
    <PlanFeatureGate feature="moeAnalytics">
      <div>
        <MoeDashboard />
      </div>
    </PlanFeatureGate>
  );
}

export default MoePage;
