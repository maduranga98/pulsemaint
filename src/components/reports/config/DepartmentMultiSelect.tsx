import { useEffect } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useDepartments } from '../../../hooks/useDepartments';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';
import SearchableMultiSelect from './SearchableMultiSelect';

/**
 * Department filter backed by the departments created in Settings → Shift
 * Configuration, instead of free-typed text. Technician/trainee/supervisor/
 * floor_operator only ever get reports for their own registered department —
 * for them this locks to that one department instead of offering a picker.
 */
export default function DepartmentMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const { departments, loading } = useDepartments(companyId);
  const { department: scopedDepartment } = useDepartmentScope();

  useEffect(() => {
    if (scopedDepartment && (values.length !== 1 || values[0] !== scopedDepartment)) {
      onChange([scopedDepartment]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedDepartment]);

  if (scopedDepartment) {
    return (
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Department</label>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {scopedDepartment}
        </div>
      </div>
    );
  }

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
