import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Clock, Users, Boxes, ChevronRight, Pencil } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types/auth';
import { CompanyProfileEditModal } from '../../components/settings/CompanyProfileEditModal';

interface Tile {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  /** Omit to show to everyone who can reach Settings. */
  roles?: UserRole[];
}

export default function SettingsPage() {
  const company = useAuthStore((s) => s.company);
  const role = useAuthStore((s) => s.userProfile?.role);
  const [editOpen, setEditOpen] = useState(false);

  const allTiles: Tile[] = [
    {
      title: 'Users',
      description: 'Manage team members, roles, and invites.',
      to: '/app/settings/users',
      icon: <Users className="w-5 h-5" />,
      // Matches the roles the old top-level "Users" nav item was visible to.
      roles: ['admin', 'supervisor', 'plant_manager', 'hr_officer'],
    },
    {
      title: 'Shifts',
      description: 'Configure shift schedules and handover rules.',
      to: '/app/settings/shifts',
      icon: <Clock className="w-5 h-5" />,
      // Plant managers and HR officers get the same Shifts tab as admins —
      // the route guard (`settings/shifts`) and firestore.rules allow all
      // three to create and edit shift configs; the tile just has to be
      // visible so the page isn't reachable by URL only.
      roles: ['admin', 'plant_manager', 'hr_officer'],
    },
    {
      title: 'Inventory Settings',
      description: 'Reorder thresholds, units, and stock policies.',
      to: '/app/inventory/settings',
      icon: <Boxes className="w-5 h-5" />,
      roles: ['admin', 'supervisor', 'plant_manager'],
    },
  ];
  const tiles = allTiles.filter((t) => !t.roles || (role && t.roles.includes(role)));

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Configure how FirmiCore works for your plant.</p>
      </div>

      <div className="px-6 py-5 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Company</h2>
            </div>
            {role === 'admin' && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {company?.logoUrl ? (
                <img src={company.logoUrl} alt={`${company.name} logo`} className="w-full h-full object-contain" />
              ) : (
                <Building2 className="w-6 h-6 text-slate-300" />
              )}
            </div>
            {company?.description && (
              <p className="text-sm text-slate-600">{company.description}</p>
            )}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{company?.name || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Industry</dt>
              <dd className="font-medium text-slate-900">{company?.industry || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Country</dt>
              <dd className="font-medium text-slate-900">{company?.country || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Timezone</dt>
              <dd className="font-medium text-slate-900">{company?.timezone || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Currency</dt>
              <dd className="font-medium text-slate-900">{company?.currency || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium text-slate-900 capitalize">{company?.plan || ''} ({company?.status || ''})</dd>
            </div>
            {company?.phone && (
              <div>
                <dt className="text-slate-500">Phone</dt>
                <dd className="font-medium text-slate-900">{company.phone}</dd>
              </div>
            )}
            {company?.email && (
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{company.email}</dd>
              </div>
            )}
            {company?.address && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Address</dt>
                <dd className="font-medium text-slate-900 whitespace-pre-wrap">{company.address}</dd>
              </div>
            )}
          </dl>
        </section>

        {editOpen && company && (
          <CompanyProfileEditModal company={company} onClose={() => setEditOpen(false)} />
        )}

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
