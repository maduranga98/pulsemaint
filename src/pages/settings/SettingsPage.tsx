import { Link } from 'react-router-dom';
import { Building2, Clock, Users, Boxes, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface Tile {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
}

export default function SettingsPage() {
  const company = useAuthStore((s) => s.company);

  const tiles: Tile[] = [
    {
      title: 'Users',
      description: 'Manage team members, roles, and invites.',
      to: '/app/settings/users',
      icon: <Users className="w-5 h-5" />,
    },
    {
      title: 'Shifts',
      description: 'Configure shift schedules and handover rules.',
      to: '/app/settings/shifts',
      icon: <Clock className="w-5 h-5" />,
    },
    {
      title: 'Inventory Settings',
      description: 'Reorder thresholds, units, and stock policies.',
      to: '/app/inventory/settings',
      icon: <Boxes className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Configure how PulseMaint works for your plant.</p>
      </div>

      <div className="px-6 py-5 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Company</h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{company?.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Industry</dt>
              <dd className="font-medium text-slate-900">{company?.industry || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Country</dt>
              <dd className="font-medium text-slate-900">{company?.country || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Timezone</dt>
              <dd className="font-medium text-slate-900">{company?.timezone || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Currency</dt>
              <dd className="font-medium text-slate-900">{company?.currency || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium text-slate-900 capitalize">{company?.plan || '—'} ({company?.status || '—'})</dd>
            </div>
          </dl>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition group"
            >
              <div className="flex items-center justify-between mb-2 text-slate-500 group-hover:text-blue-600">
                {t.icon}
                <ChevronRight className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900">{t.title}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{t.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
