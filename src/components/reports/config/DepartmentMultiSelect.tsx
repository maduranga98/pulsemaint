import MultiValueInput from './MultiValueInput';

export default function DepartmentMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return <MultiValueInput label="Department" placeholder="Production, Utilities" values={values} onChange={onChange} />;
}
