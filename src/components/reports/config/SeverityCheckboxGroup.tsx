import { useTranslation } from 'react-i18next';
import CheckboxGroup from './CheckboxGroup';

export default function SeverityCheckboxGroup({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useTranslation();
  const options = [
    t('common.reports.config.enums.severity.critical'),
    t('common.reports.config.enums.severity.high'),
    t('common.reports.config.enums.severity.medium'),
    t('common.reports.config.enums.severity.low'),
  ];
  return <CheckboxGroup label={t('common.reports.config.severityCheckboxGroup.label')} options={options} values={values} onChange={onChange} />;
}
