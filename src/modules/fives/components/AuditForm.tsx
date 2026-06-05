import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Camera, X, ChevronLeft, ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { DEFAULT_CHECKLIST, PILLAR_ORDER } from '../data/defaultChecklist';
import type {
  AuditZone,
  AuditItemScore,
  AuditDraft,
  AuditLanguage,
  AuditShift,
  PillarId,
} from '../types/fives.types';
import {
  calculateOverallScore,
  saveDraft,
  clearDraft,
  submitAudit,
  uploadAuditPhoto,
} from '../services/fives.service';

const SCORE_LABELS: Record<number, string> = {
  0: 'Not Done',
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Excellent',
};

const SCORE_COLORS: Record<number, string> = {
  0: 'bg-red-500/20 border-red-500 text-red-400',
  1: 'bg-red-500/20 border-red-500 text-red-400',
  2: 'bg-amber-500/20 border-amber-500 text-amber-400',
  3: 'bg-cyan-500/20 border-cyan-500 text-cyan-400',
  4: 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
};

const SCORE_ACTIVE: Record<number, string> = {
  0: 'bg-red-500 text-white border-red-500',
  1: 'bg-red-400 text-white border-red-400',
  2: 'bg-amber-500 text-white border-amber-500',
  3: 'bg-cyan-500 text-white border-cyan-500',
  4: 'bg-emerald-500 text-white border-emerald-500',
};

function itemDescription(
  item: (typeof DEFAULT_CHECKLIST)[0]['checklistItems'][0],
  lang: AuditLanguage,
): string {
  if (lang === 'si') return item.sinhalaDescription;
  if (lang === 'ta') return item.tamilDescription;
  return item.description;
}

function pillarName(
  pillar: (typeof DEFAULT_CHECKLIST)[0],
  lang: AuditLanguage,
): string {
  if (lang === 'si') return pillar.sinhalaName;
  if (lang === 'ta') return pillar.tamilName;
  return pillar.name;
}

// ─── Score Selector ───────────────────────────────────────────────────────────

function ScoreSelector({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: 0 | 1 | 2 | 3 | 4) => void;
}) {
  return (
    <div className="flex gap-2">
      {([0, 1, 2, 3, 4] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`flex-1 min-w-[44px] min-h-[44px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 font-bold text-lg transition-all active:scale-95 ${
            value === s ? SCORE_ACTIVE[s] : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
          aria-label={`Score ${s} — ${SCORE_LABELS[s]}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Photo Capture ────────────────────────────────────────────────────────────

function PhotoCapture({
  photos,
  onAdd,
  onRemove,
  plantId,
  auditId,
  itemId,
}: {
  photos: string[];
  onAdd: (url: string) => void;
  onRemove: (idx: number) => void;
  plantId: string;
  auditId: string;
  itemId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadAuditPhoto(file, plantId, auditId, itemId, setProgress);
      onAdd(url);
    } catch {
      // silently fail — URL won't be added
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((url, idx) => (
          <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}

        {uploading && (
          <div className="w-16 h-16 rounded-lg border border-blue-500/50 bg-blue-500/10 flex flex-col items-center justify-center gap-1">
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            <span className="text-[10px] text-blue-400">{Math.round(progress)}%</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-blue-500/10 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50"
        >
          <Camera className="h-5 w-5" />
          <span className="text-[10px] font-medium">Photo</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Pillar Step ──────────────────────────────────────────────────────────────

function PillarStep({
  pillarIndex,
  language,
  itemScores,
  onScoreChange,
  onPhotoAdd,
  onPhotoRemove,
  onNoteChange,
  plantId,
  auditId,
}: {
  pillarIndex: number;
  language: AuditLanguage;
  itemScores: Record<string, AuditItemScore>;
  onScoreChange: (itemId: string, score: 0 | 1 | 2 | 3 | 4) => void;
  onPhotoAdd: (itemId: string, url: string) => void;
  onPhotoRemove: (itemId: string, idx: number) => void;
  onNoteChange: (itemId: string, note: string) => void;
  plantId: string;
  auditId: string;
}) {
  const pillar = DEFAULT_CHECKLIST[pillarIndex];
  const scoredItems = pillar.checklistItems
    .map((ci) => itemScores[ci.id]?.score)
    .filter((s) => s !== undefined);
  const avgScore = scoredItems.length
    ? scoredItems.reduce<number>((a, b) => a + b, 0) / scoredItems.length
    : null;

  return (
    <div className="space-y-6">
      {/* Pillar Header */}
      <div className="bg-[#142849] border border-[#1E3A5F] rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{pillar.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-white font-sora">
                {pillarName(pillar, language)}
              </h2>
              <p className="text-xs text-slate-400">
                Pillar {pillarIndex + 1} of 5 · {pillar.checklistItems.length} items
              </p>
            </div>
          </div>
          {avgScore !== null && (
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black font-sora ${
                avgScore >= 3 ? 'text-emerald-400' :
                avgScore >= 2 ? 'text-cyan-400' :
                avgScore >= 1 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {avgScore.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400">avg / 4</span>
            </div>
          )}
        </div>
      </div>

      {/* Check Items */}
      {pillar.checklistItems.map((item, idx) => {
        const score = itemScores[item.id];
        const requiresPhoto = score?.score !== undefined && score.score <= 1;
        const missingPhoto = requiresPhoto && (!score?.photoUrls || score.photoUrls.length === 0);

        return (
          <div
            key={item.id}
            className={`bg-[#0F1E35] border rounded-xl p-4 space-y-3 ${
              missingPhoto ? 'border-amber-500/50' : 'border-[#1E3A5F]'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm text-slate-200 leading-relaxed flex-1">
                {itemDescription(item, language)}
              </p>
            </div>

            {/* Score Buttons */}
            <ScoreSelector
              value={score?.score}
              onChange={(v) => onScoreChange(item.id, v)}
            />

            {score?.score !== undefined && (
              <p className={`text-xs font-semibold text-center ${
                SCORE_COLORS[score.score].split(' ').find((c) => c.startsWith('text-')) ?? 'text-slate-400'
              }`}>
                {score.score} — {SCORE_LABELS[score.score]}
              </p>
            )}

            {/* Notes */}
            {score?.score !== undefined && (
              <textarea
                rows={2}
                placeholder={requiresPhoto ? 'Notes required for low score…' : 'Optional notes…'}
                value={score.notes || ''}
                onChange={(e) => onNoteChange(item.id, e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            )}

            {/* Photo */}
            {score?.score !== undefined && (
              <div>
                {missingPhoto && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Photo required for score ≤ 1
                  </div>
                )}
                <PhotoCapture
                  photos={score.photoUrls || []}
                  onAdd={(url) => onPhotoAdd(item.id, url)}
                  onRemove={(i) => onPhotoRemove(item.id, i)}
                  plantId={plantId}
                  auditId={auditId}
                  itemId={item.id}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main AuditForm ───────────────────────────────────────────────────────────

interface AuditFormProps {
  zones: AuditZone[];
  preselectedZoneId?: string;
  initialDraft?: AuditDraft | null;
  onComplete?: (auditId: string) => void;
  onCancel?: () => void;
}

export function AuditForm({
  zones,
  preselectedZoneId,
  initialDraft,
  onComplete,
  onCancel,
}: AuditFormProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const plantId = userProfile?.companyId ?? '';

  const tempAuditId = useRef(`draft_${Date.now()}`);

  // Step: 0=setup, 1-5=pillars, 6=review
  const [step, setStep] = useState(initialDraft?.currentStep ?? 0);
  const [zoneId, setZoneId] = useState(initialDraft?.zoneId ?? preselectedZoneId ?? '');
  const [auditDate, setAuditDate] = useState(
    initialDraft?.auditDate ?? new Date().toISOString().split('T')[0],
  );
  const [shift, setShift] = useState<AuditShift>(initialDraft?.shift ?? 'day');
  const [coAuditor, setCoAuditor] = useState(initialDraft?.coAuditorName ?? '');
  const [language, setLanguage] = useState<AuditLanguage>(initialDraft?.language ?? 'en');
  const [itemScores, setItemScores] = useState<Record<string, AuditItemScore>>(
    initialDraft?.itemScores ?? {},
  );
  const [signoff, setSignoff] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zone = zones.find((z) => z.id === zoneId);

  // Auto-save every 30s
  useEffect(() => {
    if (!plantId || step === 0) return;
    const draft: AuditDraft = {
      zoneId,
      zoneName: zone?.name ?? '',
      auditDate,
      shift,
      auditorId: userProfile?.id ?? '',
      auditorName: userProfile?.fullName ?? '',
      coAuditorName: coAuditor,
      language,
      itemScores,
      currentStep: step,
      lastSaved: new Date().toISOString(),
      plantId,
    };
    saveDraft(plantId, draft);
  }, [itemScores, step]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!plantId || step === 0) return;
      const draft: AuditDraft = {
        zoneId,
        zoneName: zone?.name ?? '',
        auditDate,
        shift,
        auditorId: userProfile?.id ?? '',
        auditorName: userProfile?.fullName ?? '',
        coAuditorName: coAuditor,
        language,
        itemScores,
        currentStep: step,
        lastSaved: new Date().toISOString(),
        plantId,
      };
      saveDraft(plantId, draft);
    }, 30000);
    return () => clearInterval(interval);
  }, [plantId, zoneId, auditDate, shift, coAuditor, language, itemScores, step]);

  const updateScore = useCallback(
    (itemId: string, score: 0 | 1 | 2 | 3 | 4) => {
      setItemScores((prev) => ({
        ...prev,
        [itemId]: {
          checkItemId: itemId,
          score,
          notes: prev[itemId]?.notes ?? '',
          photoUrls: prev[itemId]?.photoUrls ?? [],
          requiresAction: score <= 1,
        },
      }));
    },
    [],
  );

  const updateNote = useCallback((itemId: string, notes: string) => {
    setItemScores((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }));
  }, []);

  const addPhoto = useCallback((itemId: string, url: string) => {
    setItemScores((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        photoUrls: [...(prev[itemId]?.photoUrls ?? []), url],
      },
    }));
  }, []);

  const removePhoto = useCallback((itemId: string, idx: number) => {
    setItemScores((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        photoUrls: (prev[itemId]?.photoUrls ?? []).filter((_, i) => i !== idx),
      },
    }));
  }, []);

  // Pillar scores for review
  const pillarScores = useMemo(() => {
    const result: Record<PillarId, number> = {
      sort: 0,
      set_in_order: 0,
      shine: 0,
      standardize: 0,
      sustain: 0,
    };
    DEFAULT_CHECKLIST.forEach((pillar) => {
      const scores = pillar.checklistItems
        .map((ci) => itemScores[ci.id])
        .filter(Boolean)
        .map((s) => s.score);
      result[pillar.id] = scores.length ? scores.reduce<number>((a, b) => a + b, 0) / scores.length : 0;
    });
    return result;
  }, [itemScores]);

  const overallScore = useMemo(() => calculateOverallScore(pillarScores), [pillarScores]);

  const lowScoreItems = useMemo(
    () => Object.values(itemScores).filter((s) => s.score <= 1),
    [itemScores],
  );

  const handleSubmit = async () => {
    if (!signoff.trim()) {
      setError('Please enter your sign-off name before submitting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const allItemScores = Object.values(itemScores);
      const auditId = await submitAudit(
        {
          zoneId,
          zoneName: zone?.name ?? '',
          auditDate,
          shift,
          auditorId: userProfile?.id ?? '',
          auditorName: userProfile?.fullName ?? '',
          coAuditorName: coAuditor || undefined,
          pillarScores,
          overallScore,
          itemScores: allItemScores,
          totalItems: DEFAULT_CHECKLIST.reduce((a, p) => a + p.checklistItems.length, 0),
          scoredItems: allItemScores.length,
          status: 'draft',
          correctiveActions: [],
          submittedAt: null,
          verifiedAt: null,
          verifiedBy: null,
          plantId,
          language,
        },
        plantId,
      );
      clearDraft(plantId);
      onComplete?.(auditId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit audit');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 0: Setup ──────────────────────────────────────────────────────────

  if (step === 0) {
    return (
      <div className="max-w-lg mx-auto space-y-6 p-4">
        <div>
          <h1 className="text-xl font-bold text-white font-sora">Start 5S Audit</h1>
          <p className="text-sm text-slate-400 mt-1">Set up audit details before starting</p>
        </div>

        <div className="space-y-4">
          {/* Zone */}
          {!preselectedZoneId && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Zone</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {z.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Date</label>
            <input
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Shift */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shift</label>
            <div className="flex gap-2">
              {(['day', 'evening', 'night'] as AuditShift[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold capitalize transition-colors ${
                    shift === s
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Auditor (read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auditor</label>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm">
              {userProfile?.fullName ?? '—'}
            </div>
          </div>

          {/* Co-Auditor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Co-Auditor (optional)</label>
            <input
              type="text"
              value={coAuditor}
              onChange={(e) => setCoAuditor(e.target.value)}
              placeholder="Co-auditor name…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Checklist Language</label>
            <div className="flex gap-2">
              {([['en', 'English'], ['si', 'සිංහල'], ['ta', 'தமிழ்']] as [AuditLanguage, string][]).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    language === code
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={!zoneId}
            onClick={() => setStep(1)}
            className="flex-1 py-3 rounded-xl bg-[#1A56DB] hover:bg-blue-600 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Begin Audit →
          </button>
        </div>
      </div>
    );
  }

  // ─── Steps 1-5: Pillar Screens ──────────────────────────────────────────────

  if (step >= 1 && step <= 5) {
    const pillarIdx = step - 1;
    const isLast = step === 5;

    return (
      <div className="max-w-lg mx-auto space-y-4 pb-24">
        {/* Progress Bar */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Pillar {step} of 5</span>
            <span>{Object.keys(itemScores).length} items scored</span>
          </div>
          <div className="flex gap-1">
            {PILLAR_ORDER.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full ${i < step ? 'bg-blue-500' : 'bg-slate-700'}`}
              />
            ))}
          </div>
        </div>

        <div className="px-4">
          <PillarStep
            pillarIndex={pillarIdx}
            language={language}
            itemScores={itemScores}
            onScoreChange={updateScore}
            onPhotoAdd={addPhoto}
            onPhotoRemove={removePhoto}
            onNoteChange={updateNote}
            plantId={plantId}
            auditId={tempAuditId.current}
          />
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#0A1628] border-t border-[#1E3A5F] p-4 flex gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A56DB] hover:bg-blue-600 text-white text-sm font-bold transition-colors"
          >
            {isLast ? 'Review & Submit' : `Next: ${DEFAULT_CHECKLIST[pillarIdx + 1]?.name ?? ''}`}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 6: Review & Submit ────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto space-y-6 p-4 pb-24">
      <div>
        <h2 className="text-xl font-bold text-white font-sora">Review & Submit</h2>
        <p className="text-sm text-slate-400 mt-1">
          {zone?.name} · {auditDate} · {shift} shift
        </p>
      </div>

      {/* Overall Score */}
      <div className={`rounded-2xl border p-5 flex flex-col items-center gap-1 ${
        overallScore >= 75 ? 'bg-emerald-500/10 border-emerald-500/30' :
        overallScore >= 50 ? 'bg-cyan-500/10 border-cyan-500/30' :
        overallScore >= 25 ? 'bg-amber-500/10 border-amber-500/30' :
        'bg-red-500/10 border-red-500/30'
      }`}>
        <span className={`text-5xl font-black font-sora ${
          overallScore >= 75 ? 'text-emerald-400' :
          overallScore >= 50 ? 'text-cyan-400' :
          overallScore >= 25 ? 'text-amber-400' : 'text-red-400'
        }`}>{overallScore}%</span>
        <span className="text-sm text-slate-400">Overall 5S Score</span>
      </div>

      {/* Pillar Summary */}
      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1E3A5F]">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pillar Breakdown</p>
        </div>
        <div className="divide-y divide-[#1E3A5F]">
          {DEFAULT_CHECKLIST.map((pillar) => {
            const ps = pillarScores[pillar.id];
            const pct = Math.round((ps / 4) * 100);
            return (
              <div key={pillar.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>{pillar.icon}</span>
                  <span className="text-sm text-slate-200">{pillar.name}</span>
                </div>
                <span className={`text-sm font-bold ${
                  pct >= 75 ? 'text-emerald-400' :
                  pct >= 50 ? 'text-cyan-400' :
                  pct >= 25 ? 'text-amber-400' : 'text-red-400'
                }`}>{ps.toFixed(1)} / 4</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Corrective Actions Warning */}
      {lowScoreItems.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-400">
              {lowScoreItems.length} corrective action{lowScoreItems.length > 1 ? 's' : ''} will be auto-created
            </p>
          </div>
          <ul className="space-y-1 pl-6">
            {lowScoreItems.slice(0, 5).map((s: AuditItemScore) => {
              const item = DEFAULT_CHECKLIST.flatMap((p) => p.checklistItems).find((ci) => ci.id === s.checkItemId);
              return (
                <li key={s.checkItemId} className="text-xs text-amber-300/80 flex items-start gap-1">
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${s.score === 0 ? 'bg-red-500/30 text-red-400' : 'bg-amber-500/30 text-amber-400'}`}>
                    {s.score === 0 ? 'IMMEDIATE' : 'STANDARD'}
                  </span>
                  {item?.description.slice(0, 60)}…
                </li>
              );
            })}
            {lowScoreItems.length > 5 && (
              <li className="text-xs text-amber-500/70">+ {lowScoreItems.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Sign-off */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Supervisor Sign-off
        </label>
        <input
          type="text"
          value={signoff}
          onChange={(e) => setSignoff(e.target.value)}
          placeholder="Type your full name to confirm…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        {signoff && (
          <p className="text-xs text-slate-500">
            Signed by {signoff} on {new Date().toLocaleString()}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A1628] border-t border-[#1E3A5F] p-4 flex gap-3">
        <button
          type="button"
          onClick={() => setStep(5)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          disabled={submitting || !signoff.trim()}
          onClick={handleSubmit}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
          ) : (
            <><Check className="h-4 w-4" /> Submit Audit</>
          )}
        </button>
      </div>
    </div>
  );
}
