import MultiValueInput from './MultiValueInput';

export default function TechnicianMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return <MultiValueInput label="Technician" placeholder="Technician IDs or names" values={values} onChange={onChange} />;
}
