import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePMStore } from '../../store/pm.store';
import PMScheduleCreateForm from '../../components/pm/PMScheduleCreateForm';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export default function PMScheduleEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const schedule = usePMStore((s) => s.schedules.find((sch) => sch.id === id));
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  if (!schedule) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t('common.pmSchedules.editPage.notFound')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('common.pmSchedules.editPage.title')}</h1>
      <PMScheduleCreateForm editSchedule={schedule} isDesktop={isDesktop} />
    </div>
  );
}
