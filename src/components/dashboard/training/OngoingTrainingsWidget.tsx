import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import TrainingProgressBar from '../../training/shared/TrainingProgressBar';
import { useOngoingTrainings } from '../../../hooks/dashboard/useOngoingTrainings';
import { useTranslation } from 'react-i18next';

interface OngoingTrainingsWidgetProps {
  companyId: string;
}

export default function OngoingTrainingsWidget({ companyId }: OngoingTrainingsWidgetProps) {
  const { t } = useTranslation();
  const { trainings, loading, error } = useOngoingTrainings(companyId);

  return (
    <DashboardWidget
      title={t('common.widgets.ongoingTrainingsWidget.title')}
      loading={loading}
      error={error}
      action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.ongoingTrainingsWidget.inProgress', { count: trainings.length })}</span>}
    >
      {trainings.length === 0 ? (
        <EmptyState message={t('common.widgets.ongoingTrainingsWidget.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">{t('common.widgets.ongoingTrainingsWidget.name')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.ongoingTrainingsWidget.role')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.ongoingTrainingsWidget.module')}</th>
                <th className="pb-2 font-medium w-40">{t('common.widgets.ongoingTrainingsWidget.progress')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {trainings.map((t) => (
                <tr key={t.id}>
                  <td className="py-2.5 text-[#F0F4F8] font-medium whitespace-nowrap">{t.traineeName}</td>
                  <td className="py-2.5 text-[#8BA3BF] whitespace-nowrap capitalize">{t.traineeRole.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 text-[#8BA3BF]">{t.moduleName}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-[80px]">
                        <TrainingProgressBar progress={t.overallProgress} />
                      </div>
                      <span className="text-[#F0F4F8] shrink-0">{t.overallProgress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
