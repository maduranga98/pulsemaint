import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Users, ChevronRight, Pencil } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types/auth';
import { CompanyProfileEditModal } from '../../components/settings/CompanyProfileEditModal';
import { CompanySmtpSettings } from '../../components/settings/CompanySmtpSettings';

interface Tile {
  title: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  /** Omit to show to everyone who can reach Settings. */
  roles?: UserRole[];
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const role = useAuthStore((s) => s.userProfile?.role);
  const [editOpen, setEditOpen] = useState(false);

  const allTiles: Tile[] = [
    {
      title: t('common.settings.page.tiles.users.title', 'Users'),
      description: t('common.settings.page.tiles.users.description', 'Manage team members, roles, and invites.'),
      to: '/app/settings/users',
      icon: <Users className="w-5 h-5" />,
      // Matches the roles the old top-level "Users" nav item was visible to.
      roles: ['admin', 'supervisor', 'plant_manager', 'hr_officer'],
    },
  ];
  const tiles = allTiles.filter((tile) => !tile.roles || (role && tile.roles.includes(role)));

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900">{t('common.settings.page.title', 'Settings')}</h1>
        <p className="text-sm text-slate-500">{t('common.settings.page.subtitle', 'Configure how FirmiCore works for your plant.')}</p>
      </div>

      <div className="px-6 py-5 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-500" />
              <h2 className="font-semibold text-slate-900">{t('common.settings.page.company.heading', 'Company')}</h2>
            </div>
            {role === 'admin' && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Pencil className="w-3.5 h-3.5" />
                {t('common.settings.page.company.editProfile', 'Edit Profile')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {company?.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={t('common.settings.page.company.logoAlt', '{{name}} logo', { name: company.name })}
                  className="w-full h-full object-contain"
                />
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
              <dt className="text-slate-500">{t('common.settings.page.company.name', 'Name')}</dt>
              <dd className="font-medium text-slate-900">{company?.name || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('common.settings.page.company.industry', 'Industry')}</dt>
              <dd className="font-medium text-slate-900">{company?.industry || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('common.settings.page.company.country', 'Country')}</dt>
              <dd className="font-medium text-slate-900">{company?.country || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('common.settings.page.company.timezone', 'Timezone')}</dt>
              <dd className="font-medium text-slate-900">{company?.timezone || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('common.settings.page.company.currency', 'Currency')}</dt>
              <dd className="font-medium text-slate-900">{company?.currency || ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('common.settings.page.company.plan', 'Plan')}</dt>
              <dd className="font-medium text-slate-900 capitalize">
                {t('common.settings.page.company.planWithStatus', '{{plan}} ({{status}})', {
                  plan: company?.plan || '',
                  status: company?.status || '',
                })}
              </dd>
            </div>
            {company?.phone && (
              <div>
                <dt className="text-slate-500">{t('common.settings.page.company.phone', 'Phone')}</dt>
                <dd className="font-medium text-slate-900">{company.phone}</dd>
              </div>
            )}
            {company?.email && (
              <div>
                <dt className="text-slate-500">{t('common.settings.page.company.email', 'Email')}</dt>
                <dd className="font-medium text-slate-900">{company.email}</dd>
              </div>
            )}
            {company?.address && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">{t('common.settings.page.company.address', 'Address')}</dt>
                <dd className="font-medium text-slate-900 whitespace-pre-wrap">{company.address}</dd>
              </div>
            )}
          </dl>
        </section>

        {editOpen && company && (
          <CompanyProfileEditModal company={company} onClose={() => setEditOpen(false)} />
        )}

        {role === 'admin' && <CompanySmtpSettings />}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition group"
            >
              <div className="flex items-center justify-between mb-2 text-slate-500 group-hover:text-blue-600">
                {tile.icon}
                <ChevronRight className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900">{tile.title}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{tile.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
