import MultiValueInput from './MultiValueInput';

export default function ContractorMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return <MultiValueInput label="Contractor" placeholder="Contractor IDs or companies" values={values} onChange={onChange} />;
}
