import MultiValueInput from './MultiValueInput';

export default function MachineMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  return <MultiValueInput label="Machine" placeholder="Machine IDs or names, comma separated" values={values} onChange={onChange} />;
}
