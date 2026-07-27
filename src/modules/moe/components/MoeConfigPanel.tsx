import { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { useMoeConfig } from '../hooks/useMoe';
import { saveMoeConfig } from '../services/moe.service';
import { isWeightsValid } from '../types/moe.types';
import type { MoeConfig } from '../types/moe.types';

interface MoeConfigPanelProps {
  onBack?: () => void;
}

export function MoeConfigPanel({ onBack }: MoeConfigPanelProps) {
  const { config, siteId, loading } = useMoeConfig();
  const [draft, setDraft] = useState<MoeConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  if (loading || !draft) {
    return <p className="text-sm text-[#8BA3BF]">Loading configuration…</p>;
  }

  const weightsSum =
    draft.weights.availability + draft.weights.maintenanceCompliance + draft.weights.reliability + draft.weights.health;
  const valid = isWeightsValid(draft.weights);

  const updateWeight = (key: keyof MoeConfig['weights'], value: number) => {
    setDraft({ ...draft, weights: { ...draft.weights, [key]: value } });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!draft || !siteId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveMoeConfig(draft);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white font-[Sora]">MOE Configuration</h1>
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm text-[#8BA3BF] hover:text-white">
            Back
          </button>
        )}
      </div>

      <div className="bg-[#1A1408] border border-[#F59E0B]/40 rounded-lg p-3 flex gap-2 text-sm text-[#F59E0B]">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Changing weights does not retroactively recalculate historical MOE snapshots — only future calculations use the new weights.</p>
      </div>

      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-white">Score Weights (must sum to 1.0)</h2>
        {(
          [
            ['availability', 'Availability'],
            ['maintenanceCompliance', 'Maintenance Compliance'],
            ['reliability', 'Reliability'],
            ['health', 'Health'],
          ] as [keyof MoeConfig['weights'], string][]
        ).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <label className="text-sm text-[#8BA3BF] w-56">{label}</label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={draft.weights[key]}
              onChange={(e) => updateWeight(key, Number(e.target.value))}
              className="bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-2 py-1.5 text-sm text-white w-24"
            />
          </div>
        ))}
        <p className={`text-xs font-medium ${valid ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
          Sum: {weightsSum.toFixed(2)} {valid ? '(valid)' : '(must equal 1.00)'}
        </p>
      </div>

      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-white">Other Parameters</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[#8BA3BF] w-56">Reliability penalty factor / breakdown</label>
          <input
            type="number"
            min={0}
            value={draft.reliabilityPenaltyFactor}
            onChange={(e) => setDraft({ ...draft, reliabilityPenaltyFactor: Number(e.target.value) })}
            className="bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-2 py-1.5 text-sm text-white w-24"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[#8BA3BF] w-56">Critical MOE threshold</label>
          <input
            type="number"
            min={0}
            max={100}
            value={draft.criticalMoeThreshold}
            onChange={(e) => setDraft({ ...draft, criticalMoeThreshold: Number(e.target.value) })}
            className="bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-2 py-1.5 text-sm text-white w-24"
          />
        </div>
      </div>

      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-white">Status Bands</h2>
        {(
          [
            ['excellent', 'Excellent (≥)'],
            ['good', 'Good (≥)'],
            ['atRisk', 'At Risk (≥, below is Critical)'],
          ] as [keyof MoeConfig['statusBands'], string][]
        ).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <label className="text-sm text-[#8BA3BF] w-56">{label}</label>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.statusBands[key]}
              onChange={(e) =>
                setDraft({ ...draft, statusBands: { ...draft.statusBands, [key]: Number(e.target.value) } })
              }
              className="bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-2 py-1.5 text-sm text-white w-24"
            />
          </div>
        ))}
      </div>

      {saveError && <p className="text-sm text-[#EF4444]">{saveError}</p>}
      {saved && <p className="text-sm text-[#10B981]">Configuration saved.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!valid || saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00C2FF] text-[#0A1628] font-semibold text-sm disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save configuration'}
      </button>
    </div>
  );
}
