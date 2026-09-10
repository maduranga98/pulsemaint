import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import SearchableMultiSelect, { type SelectOption } from './SearchableMultiSelect';

/**
 * Technician filter backed by registered users with the technician role
 * (companies/{companyId}/users) so selected values are real user IDs that
 * match what work order / breakdown documents store as assignee.
 */
export default function TechnicianMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, `companies/${companyId}/users`), where('role', '==', 'technician')),
        );
        const opts = snap.docs.map((d) => {
          const data = d.data();
          return {
            value: d.id,
            label: String(data.fullName ?? d.id),
            hint: String(data.jobTitle ?? data.department ?? ''),
          };
        });
        if (!cancelled) setOptions(opts.sort((a, b) => a.label.localeCompare(b.label)));
      } catch {
        /* leave options empty on permission/network errors */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <SearchableMultiSelect
      label={t('common.reports.config.technicianMultiSelect.label')}
      options={options}
      values={values}
      onChange={onChange}
      placeholder={t('common.reports.config.technicianMultiSelect.placeholder')}
      loading={loading}
    />
  );
}
