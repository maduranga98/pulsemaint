import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useInventorySettings } from '@/hooks/inventory/useInventorySettings';
import { useToast } from '@/hooks/useToast';

const ROLE_OPTIONS = ['store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician'];

export function InventorySettingsPage() {
  const { addToast } = useToast();
  const canAccess = useAuthStore((s) =>
    s.canAccess(['supervisor', 'plant_manager', 'admin'])
  );

  const { settings, loading, updateSettings } = useInventorySettings();

  // Local state per section
  const [threshold, setThreshold] = useState(5000);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifRoles, setNotifRoles] = useState<string[]>(['store_keeper', 'supervisor']);
  const [partPrefix, setPartPrefix] = useState('PRT');
  const [poPrefix, setPoPrefix] = useState('PO');
  const [reqPrefix, setReqPrefix] = useState('REQ');
  const [requireReturn, setRequireReturn] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setThreshold(settings.approvalThresholdLKR);
      setNotifEnabled(settings.lowStockAlertEnabled);
      setNotifRoles(settings.lowStockNotifyRoles);
      setPartPrefix(settings.partNumberPrefix || 'PRT');
      setPoPrefix(settings.poNumberPrefix || 'PO');
      setReqPrefix(settings.requestNumberPrefix || 'REQ');
      setRequireReturn(settings.requireReturnLog);
    }
  }, [settings]);

  if (!canAccess) {
    return <Navigate to="/app/inventory" replace />;
  }

  async function save(section: string, updates: Parameters<typeof updateSettings>[0]) {
    setSaving(section);
    try {
      await updateSettings(updates);
      addToast('Settings saved.', 'success');
    } catch {
      addToast('Failed to save settings.', 'error');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className="h-32 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Inventory Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configure approval thresholds, notifications, and more.</p>
      </div>

      {/* 1. Approval Threshold */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Approval Thresholds</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auto-approve requests below (LKR)
          </label>
          <input
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
          />
          <p className="text-xs text-gray-400 mt-1">
            Requests with total estimated cost below this value will be auto-approved by the store keeper.
          </p>
        </div>
        <button
          onClick={() => save('threshold', { approvalThresholdLKR: threshold })}
          disabled={saving === 'threshold'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          {saving === 'threshold' ? 'Saving…' : 'Save Threshold'}
        </button>
      </div>

      {/* 2. Notifications */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Notifications</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNotifEnabled((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${notifEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            aria-checked={notifEnabled}
            role="switch"
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifEnabled ? 'left-6' : 'left-1'}`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">Enable low stock alerts</span>
        </div>

        {notifEnabled && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Notify roles</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  onClick={() => setNotifRoles((prev) =>
                    prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                  )}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                    ${notifRoles.includes(role)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}
                  `}
                >
                  {role.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => save('notifications', {
            lowStockAlertEnabled: notifEnabled,
            lowStockNotifyRoles: notifRoles,
          })}
          disabled={saving === 'notifications'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          {saving === 'notifications' ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* 3. Numbering Prefixes */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Numbering Prefixes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Part Number Prefix', value: partPrefix, onChange: setPartPrefix },
            { label: 'PO Number Prefix', value: poPrefix, onChange: setPoPrefix },
            { label: 'Request Prefix', value: reqPrefix, onChange: setReqPrefix },
          ].map(({ label, value, onChange }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Preview: <span className="font-mono font-semibold">{partPrefix}-0001</span> · {' '}
          <span className="font-mono font-semibold">{poPrefix}-{new Date().getFullYear()}-0001</span> · {' '}
          <span className="font-mono font-semibold">{reqPrefix}-{new Date().getFullYear()}-0001</span>
        </p>
        <button
          onClick={() => save('prefixes', {
            partNumberPrefix: partPrefix,
            poNumberPrefix: poPrefix,
            requestNumberPrefix: reqPrefix,
          })}
          disabled={saving === 'prefixes'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          {saving === 'prefixes' ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* 4. Return Policy */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Return Policy</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRequireReturn((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${requireReturn ? 'bg-blue-600' : 'bg-gray-300'}`}
            aria-checked={requireReturn}
            role="switch"
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${requireReturn ? 'left-6' : 'left-1'}`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">
            Require technicians to log unused part returns
          </span>
        </div>
        <button
          onClick={() => save('return', { requireReturnLog: requireReturn })}
          disabled={saving === 'return'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          {saving === 'return' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
export default InventorySettingsPage;
