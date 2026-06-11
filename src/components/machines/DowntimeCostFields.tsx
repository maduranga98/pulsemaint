import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { computeEffectiveCostPerHour } from '../../lib/downtimeCost';

interface DowntimeCostFieldsProps {
  machine: any;
  canEdit: boolean;
}

type CostMode = 'direct' | 'units';
type Currency = 'LKR' | 'USD' | 'AED' | 'SAR';

export function DowntimeCostFields({ machine, canEdit }: DowntimeCostFieldsProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialMode: CostMode =
    machine.costPerHourDown != null ? 'direct' : 'units';

  const [mode, setMode] = useState<CostMode>(initialMode);
  const [directRate, setDirectRate] = useState<string>(
    machine.costPerHourDown != null ? String(machine.costPerHourDown) : '',
  );
  const [unitsPerHour, setUnitsPerHour] = useState<string>(
    machine.unitsPerHour != null ? String(machine.unitsPerHour) : '',
  );
  const [unitValue, setUnitValue] = useState<string>(
    machine.unitValue != null ? String(machine.unitValue) : '',
  );
  const [currency, setCurrency] = useState<Currency>(
    (machine.costCurrency as Currency) ?? 'LKR',
  );

  const effectiveRate = computeEffectiveCostPerHour(
    machine.costPerHourDown ?? null,
    machine.unitsPerHour ?? null,
    machine.unitValue ?? null,
  );

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        costCurrency: currency,
        updatedAt: serverTimestamp(),
      };

      if (mode === 'direct') {
        const rate = parseFloat(directRate);
        updates.costPerHourDown = isNaN(rate) ? null : rate;
        updates.unitsPerHour = null;
        updates.unitValue = null;
      } else {
        const uph = parseFloat(unitsPerHour);
        const uv = parseFloat(unitValue);
        updates.costPerHourDown = null;
        updates.unitsPerHour = isNaN(uph) ? null : uph;
        updates.unitValue = isNaN(uv) ? null : uv;
      }

      await updateDoc(doc(db, 'machines', machine.id), updates);
      toast.success('Downtime cost rates updated.');
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setMode(initialMode);
    setDirectRate(machine.costPerHourDown != null ? String(machine.costPerHourDown) : '');
    setUnitsPerHour(machine.unitsPerHour != null ? String(machine.unitsPerHour) : '');
    setUnitValue(machine.unitValue != null ? String(machine.unitValue) : '');
    setCurrency((machine.costCurrency as Currency) ?? 'LKR');
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Downtime Cost</h3>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="text-sm">
          {effectiveRate !== null ? (
            <div className="space-y-1">
              <p className="text-gray-900 font-medium">
                {machine.costCurrency ?? 'LKR'} {effectiveRate.toLocaleString()}/hr
              </p>
              {machine.costPerHourDown != null ? (
                <p className="text-gray-500 text-xs">Direct hourly rate</p>
              ) : (
                <p className="text-gray-500 text-xs">
                  {machine.unitsPerHour} units/hr × {machine.costCurrency ?? 'LKR'}{' '}
                  {machine.unitValue?.toLocaleString()}/unit
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">
              No downtime cost configured.{' '}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-blue-600 hover:underline"
                >
                  Configure now
                </button>
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mode radio */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={mode === 'direct'}
                onChange={() => setMode('direct')}
                className="text-blue-600"
              />
              Direct hourly rate
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={mode === 'units'}
                onChange={() => setMode('units')}
                className="text-blue-600"
              />
              Units × value
            </label>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="LKR">LKR</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
              <option value="SAR">SAR</option>
            </select>
          </div>

          {mode === 'direct' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cost per hour down ({currency})
              </label>
              <input
                type="number"
                value={directRate}
                onChange={(e) => setDirectRate(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Units produced per hour
                </label>
                <input
                  type="number"
                  value={unitsPerHour}
                  onChange={(e) => setUnitsPerHour(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Value per unit ({currency})
                </label>
                <input
                  type="number"
                  value={unitValue}
                  onChange={(e) => setUnitValue(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {(() => {
            const previewRate =
              mode === 'direct'
                ? parseFloat(directRate) || null
                : (parseFloat(unitsPerHour) || null) !== null &&
                  (parseFloat(unitValue) || null) !== null
                ? parseFloat(unitsPerHour) * parseFloat(unitValue)
                : null;
            return previewRate !== null ? (
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700">
                Effective rate: {currency} {previewRate.toLocaleString()}/hr
              </div>
            ) : null;
          })()}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
