import { useTranslation } from 'react-i18next';
import CheckboxGroup from './CheckboxGroup';

export default function ShiftCheckboxGroup({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useTranslation();
  const options = [
    t('common.reports.config.enums.shift.morning'),
    t('common.reports.config.enums.shift.afternoon'),
    t('common.reports.config.enums.shift.night'),
  ];
  return <CheckboxGroup label={t('common.reports.config.shiftCheckboxGroup.label')} options={options} values={values} onChange={onChange} />;
}
