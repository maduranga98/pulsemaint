import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { planLimitsFor, type PlanLimitConfig } from '../../lib/planLimits';

type FeatureKey = keyof PlanLimitConfig['features'];

const FEATURE_LABEL: Record<FeatureKey, string> = {
  autoPOEmail: 'Automatic PO email to suppliers',
  qrLowStockAlerts: 'Inventory QR scan & low-stock alerts',
  contractors: 'Contractor management',
  shiftHandover: 'Shift handover & briefings',
  training: 'Training module',
  safety: 'Safety Workspace',
  moeAnalytics: 'MOE trend analytics & machine comparison',
  multiSite: 'Multi-site management',
};

interface PlanFeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

/**
 * Blocks a whole page behind the company's plan tier, matching the feature
 * matrix in lib/planLimits.ts (kept in sync with the customer pricing
 * sheet). Renders an upgrade prompt instead of the page content when the
 * current plan doesn't include the feature.
 */
export function PlanFeatureGate({ feature, children }: PlanFeatureGateProps) {
  const { t } = useTranslation();
  const plan = useAuthStore((s) => s.company?.plan);
  const included = planLimitsFor(plan).features[feature];

  if (included) return <>{children}</>;

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
        <Lock className="w-8 h-8 text-amber-500 mx-auto" />
        <h1 className="text-lg font-bold text-slate-900">{t('common.ui.planGate.title')}</h1>
        <p className="text-sm text-slate-600">
          {t('common.ui.planGate.notIncluded', { feature: t(`common.ui.planGate.features.${feature}`, { defaultValue: FEATURE_LABEL[feature] }) })}
        </p>
        <Link
          to="/app/billing"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          {t('common.ui.planGate.viewPlans')}
        </Link>
      </div>
    </div>
  );
}
