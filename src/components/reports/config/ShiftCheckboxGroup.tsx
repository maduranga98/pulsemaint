import CheckboxGroup from './CheckboxGroup';

export default function ShiftCheckboxGroup({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return <CheckboxGroup label="Shift" options={['Morning', 'Afternoon', 'Night']} values={values} onChange={onChange} />;
}
