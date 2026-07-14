import { useAuthStore } from '../../../store/authStore';
import { useDepartments } from '../../../hooks/useDepartments';
import SearchableMultiSelect from './SearchableMultiSelect';

/**
 * Department filter backed by the departments created in Settings → Shift
 * Configuration, instead of free-typed text.
 */
export default function DepartmentMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const { departments, loading } = useDepartments(companyId);

  return (
    <SearchableMultiSelect
      label="Department"
      options={departments.map((name) => ({ value: name, label: name }))}
      values={values}
      onChange={onChange}
      placeholder="Search departments…"
      loading={loading}
    />
  );
}
