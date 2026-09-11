import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Factory, Plus, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { subscribePlants, createPlant, updatePlant } from '../../services/plants.service';
import type { Plant } from '../../types/plant';

export default function PlantsPage() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const userId = useAuthStore((s) => s.user?.uid);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plant | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    return subscribePlants(company.id, setPlants, setError);
  }, [company?.id]);

  function openCreate() {
    setEditing(null);
    setName('');
    setCode('');
    setAddress('');
    setModalOpen(true);
  }

  function openEdit(plant: Plant) {
    setEditing(plant);
    setName(plant.name);
    setCode(plant.code ?? '');
    setAddress(plant.address ?? '');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!company?.id || !userId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updatePlant(editing.id, userId, {
          name: name.trim(),
          code: code.trim() || null,
          address: address.trim() || null,
        });
      } else {
        await createPlant(company.id, userId, {
          name: name.trim(),
          code: code.trim() || null,
          address: address.trim() || null,
        });
      }
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(plant: Plant) {
    if (!userId) return;
    await updatePlant(plant.id, userId, {
      status: plant.status === 'active' ? 'inactive' : 'active',
    });
  }

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('common.settings.plants.title', 'Plants')}</h1>
          <p className="text-sm text-slate-500">
            {t('common.settings.plants.subtitle', 'Manage the plants users, machines, contractors and inventory are registered under.')}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          {t('common.settings.plants.addPlant', 'Add Plant')}
        </button>
      </div>

      <div className="px-6 py-5">
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {plants.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">
              {t('common.settings.plants.empty', 'No plants yet. Add your first plant to start scoping users, machines, contractors and inventory by plant.')}
            </div>
          )}
          {plants.map((plant) => (
            <div key={plant.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Factory className="w-5 h-5 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-900">{plant.name}</div>
                  <div className="text-xs text-slate-500">
                    {[plant.code, plant.address].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    plant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {plant.status === 'active'
                    ? t('common.status.active', 'Active')
                    : t('common.status.inactive', 'Inactive')}
                </span>
                <button
                  type="button"
                  onClick={() => toggleStatus(plant)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  {plant.status === 'active'
                    ? t('common.actions.deactivate', 'Deactivate')
                    : t('common.actions.activate', 'Activate')}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(plant)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  {t('common.actions.edit', 'Edit')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">
                {editing
                  ? t('common.settings.plants.editPlant', 'Edit Plant')
                  : t('common.settings.plants.addPlant', 'Add Plant')}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('common.settings.plants.name', 'Plant name')}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={t('common.settings.plants.namePlaceholder', 'e.g. Colombo Plant') || ''}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('common.settings.plants.code', 'Code (optional)')}
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t('common.settings.plants.address', 'Address (optional)')}
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('common.actions.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t('common.actions.saving', 'Saving…') : t('common.actions.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
