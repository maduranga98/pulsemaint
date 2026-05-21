import CheckboxGroup from './CheckboxGroup';

export default function SeverityCheckboxGroup({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return <CheckboxGroup label="Severity" options={['Critical', 'High', 'Medium', 'Low']} values={values} onChange={onChange} />;
}
