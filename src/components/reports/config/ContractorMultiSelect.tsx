import { useMemo } from 'react';
import { useContractors } from '../../../hooks/contractors/useContractors';
import SearchableMultiSelect, { type SelectOption } from './SearchableMultiSelect';

/**
 * Contractor filter backed by the registered contractors collection so
 * selected values match the contractor IDs stored on work orders/invoices,
 * instead of free-typed company names.
 */
export default function ContractorMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const { contractors, loading } = useContractors();

  const options: SelectOption[] = useMemo(
    () =>
      contractors
        .map((c) => ({
          value: c.id,
          label: c.companyName,
          hint: c.tradeName ?? c.status,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [contractors],
  );

  return (
    <SearchableMultiSelect
      label="Contractor"
      options={options}
      values={values}
      onChange={onChange}
      placeholder="Search contractors…"
      loading={loading}
    />
  );
}
