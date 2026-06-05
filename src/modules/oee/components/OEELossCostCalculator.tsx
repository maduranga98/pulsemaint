import { useState } from 'react';
import { toast } from 'sonner';
import { Calculator, TrendingUp, Save } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useBigLosses } from '../hooks/useOEE';
import { saveOEETarget } from '../services/oee.service';

interface OEELossCostCalculatorProps {
  machineId: string;
  month: string;
}

export function OEELossCostCalculator({ machineId, month }: OEELossCostCalculatorProps) {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [lkrPerHour, setLkrPerHour] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const { losses, totalLostHours, loading } = useBigLosses(month, lkrPerHour);

  const totalLoss = losses.reduce((s, l) => s + l.lkrCost, 0);
  const currentOEE = losses.length > 0
    ? Math.max(0, 100 - losses.reduce((s, l) => s + l.percentage, 0))
    : 0;
  const targetOEE = 85;
  const potentialGain = currentOEE < targetOEE
    ? Math.round(((targetOEE - currentOEE) / 100) * lkrPerHour * totalLostHours)
    : 0;

  function applyRate() {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val < 0) return;
    setLkrPerHour(val);
  }

  async function saveConfig() {
    if (!plantId || !machineId) return;
    setSaving(true);
    try {
      await saveOEETarget(plantId, {
        machineId,
        targetOEE: 85,
        targetAvailability: 90,
        targetPerformance: 95,
        targetQuality: 99,
        lkrPerHour,
      });
      toast.success('LKR/hour configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors';

  return (
    <div className="space-y-6">
      {/* Rate input */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">Production Value Rate</h3>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">LKR per production hour</label>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={inputCls + ' w-full'}
              placeholder="e.g. 50000"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={applyRate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Apply
            </button>
            <button
              onClick={saveConfig}
              disabled={saving || lkrPerHour === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm rounded-xl transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Loss breakdown */}
      {lkrPerHour > 0 && !loading && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Monthly Loss Breakdown — {month}</h3>
          {losses.map((loss) => (
            <div
              key={loss.category}
              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 rounded" style={{ backgroundColor: loss.color }} />
                <div>
                  <p className="text-sm text-white">{loss.label}</p>
                  <p className="text-xs text-slate-500">{loss.hours}h lost</p>
                </div>
              </div>
              <p className="font-bold text-sm" style={{ color: loss.color }}>
                LKR {loss.lkrCost.toLocaleString()}
              </p>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between p-4 bg-red-900/20 border border-red-800/40 rounded-xl mt-2">
            <div>
              <p className="text-sm font-semibold text-white">Total Monthly Production Loss</p>
              <p className="text-xs text-slate-400">{totalLostHours.toFixed(1)}h × LKR {lkrPerHour.toLocaleString()}/h</p>
            </div>
            <p className="text-xl font-bold text-red-400 font-sora">LKR {totalLoss.toLocaleString()}</p>
          </div>

          {/* Potential gain */}
          {potentialGain > 0 && (
            <div className="flex items-start gap-3 p-4 bg-emerald-900/20 border border-emerald-800/40 rounded-xl">
              <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  Potential Gain if OEE reaches 85%
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Current effective OEE: {currentOEE.toFixed(1)}% → Target: {targetOEE}%
                </p>
                <p className="text-2xl font-bold text-emerald-400 font-sora mt-2">
                  + LKR {potentialGain.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">per month</p>
              </div>
            </div>
          )}
        </div>
      )}

      {lkrPerHour === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Calculator className="h-10 w-10 mx-auto mb-3 text-slate-700" />
          <p className="text-sm">Enter your production value per hour and click Apply</p>
          <p className="text-xs mt-1">to see loss costs broken down by category</p>
        </div>
      )}
    </div>
  );
}
