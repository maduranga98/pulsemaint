import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { CompanyProfile } from '@/types/auth';

/**
 * Admin switch for server-enforced department isolation (firestore.rules:
 * departmentIsolationOn). Off by default because the rules compare the
 * department strings on users and records exactly — check that technicians'
 * departments match their machines' departments before switching it on.
 */
export function DepartmentIsolationCard({ company }: { company: CompanyProfile }) {
  const { t } = useTranslation();
  const setCompany = useAuthStore((s) => s.setCompany);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const enabled = company.departmentIsolation === true;

  async function toggle() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'companies', company.id), { departmentIsolation: !enabled });
      setCompany({ ...company, departmentIsolation: !enabled });
      toast.success(
        !enabled
          ? t('common.settings.departmentIsolation.on', 'Department restriction is on.')
          : t('common.settings.departmentIsolation.off', 'Department restriction is off.'),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.settings.departmentIsolation.failed', 'Could not change the setting.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 mt-0.5 text-slate-500" />
          <div>
            <h2 className="font-semibold text-slate-900">
              {t('common.settings.departmentIsolation.title', 'Restrict by department')}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 max-w-xl">
              {t(
                'common.settings.departmentIsolation.description',
                'Technicians, trainees, supervisors and floor operators will see work orders and breakdowns of their own department only (work assigned to them stays visible). Records without a department are hidden from them, so make sure each person\'s department matches the department on their machines before switching this on.',
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={() => void toggle()}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </section>
  );
}
