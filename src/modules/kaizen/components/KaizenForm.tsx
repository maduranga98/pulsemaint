import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Camera, Tag, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/authStore';
import { createKaizen, uploadKaizenPhoto } from '../services/kaizen.service';
import type { KaizenCategory, KaizenPriority } from '../types/kaizen.types';
import { KAIZEN_CATEGORY_META, KAIZEN_PRIORITY_META } from '../types/kaizen.types';
import { KaizenCard as KaizenCardPreview } from './KaizenCard';
import type { KaizenCard } from '../types/kaizen.types';
import { Timestamp } from 'firebase/firestore';

const DRAFT_KEY = 'kaizen_form_draft';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Max 120 characters'),
  problemStatement: z.string().min(10, 'Describe the problem in at least 10 characters'),
  category: z.enum(['safety', 'quality', 'efficiency', '5s', 'cost', 'environment', 'other'] as const),
  priority: z.enum(['low', 'medium', 'high', 'critical'] as const),
  areaType: z.enum(['machine', 'area']),
  machineId: z.string().optional(),
  machineName: z.string().optional(),
  area: z.string().optional(),
  suggestedSolution: z.string().min(10, 'Describe the solution in at least 10 characters'),
  estimatedCost: z.number().nonnegative().optional(),
  estimatedBenefit: z.number().nonnegative().optional(),
  tags: z.array(z.string()),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onCreated?: (id: string) => void;
}

const CATEGORIES: KaizenCategory[] = ['safety', 'quality', 'efficiency', '5s', 'cost', 'environment', 'other'];
const PRIORITIES: KaizenPriority[] = ['low', 'medium', 'high', 'critical'];

export function KaizenForm({ onClose, onCreated }: Props) {
  const plantId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const userId = useAuthStore((s) => s.userProfile?.id ?? '');
  const userName = useAuthStore((s) => s.userProfile?.fullName ?? '');

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tempCardId] = useState(() => `temp_${Date.now()}`);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: (() => {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        return saved ? JSON.parse(saved) : {
          category: 'efficiency',
          priority: 'medium',
          areaType: 'area',
          tags: [],
        };
      } catch {
        return { category: 'efficiency', priority: 'medium', areaType: 'area', tags: [] };
      }
    })(),
  });

  const values = watch();

  // Auto-save draft
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()));
    }, 500);
    return () => clearTimeout(id);
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadKaizenPhoto(file, plantId, tempCardId, 'before');
      setBeforePhotos((prev) => [...prev, url]);
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    const cur = getValues('tags') ?? [];
    if (!cur.includes(t)) setValue('tags', [...cur, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setValue('tags', (getValues('tags') ?? []).filter((t) => t !== tag));
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const area =
        data.areaType === 'machine'
          ? data.machineName ?? data.machineId ?? ''
          : data.area ?? '';

      const id = await createKaizen({
        title: data.title,
        description: data.problemStatement,
        problemStatement: data.problemStatement,
        suggestedSolution: data.suggestedSolution,
        machineId: data.areaType === 'machine' ? data.machineId : undefined,
        machineName: data.areaType === 'machine' ? data.machineName : undefined,
        area,
        category: data.category,
        priority: data.priority,
        estimatedCost: data.estimatedCost,
        estimatedBenefit: data.estimatedBenefit,
        tags: data.tags,
        beforePhotos,
        raisedBy: userId,
        raisedByName: userName,
        plantId,
      });
      localStorage.removeItem(DRAFT_KEY);
      toast.success('Kaizen raised successfully!');
      onCreated?.(id);
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Failed to create Kaizen');
    } finally {
      setSubmitting(false);
    }
  }

  // Preview card
  const previewCard: KaizenCard = {
    id: 'preview',
    title: values.title || 'Card Title',
    description: values.problemStatement || '',
    problemStatement: values.problemStatement || '',
    suggestedSolution: values.suggestedSolution || '',
    area: values.areaType === 'machine' ? (values.machineName ?? '') : (values.area ?? ''),
    machineName: values.areaType === 'machine' ? values.machineName : undefined,
    raisedBy: userId,
    raisedByName: userName,
    raisedAt: Timestamp.now(),
    category: values.category ?? 'efficiency',
    priority: values.priority ?? 'medium',
    status: 'RAISED',
    estimatedBenefit: values.estimatedBenefit,
    implementedBy: [],
    votes: [],
    voteCount: 0,
    comments: [],
    beforePhotos,
    afterPhotos: [],
    attachments: [],
    tags: values.tags ?? [],
    plantId,
    stateHistory: [],
  };

  const steps = ['Problem', 'Solution', 'Preview'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Raise a Kaizen</h2>
            <p className="text-xs text-gray-500">Step {step + 1} of {steps.length}: {steps[step]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-3 gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── Step 0: Problem ── */}
          {step === 0 && (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    {...register('title')}
                    maxLength={120}
                    placeholder="Brief description of the issue"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-400">
                    {(values.title ?? '').length}/120
                  </span>
                </div>
                {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title.message}</p>}
              </div>

              {/* Problem statement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What is the problem? <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('problemStatement')}
                  rows={3}
                  placeholder="Describe the current problem clearly..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.problemStatement && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.problemStatement.message}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => {
                    const meta = KAIZEN_CATEGORY_META[cat];
                    const selected = values.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setValue('category', cat)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <span className="text-lg">{meta.icon}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex gap-2 flex-wrap">
                  {PRIORITIES.map((p) => {
                    const meta = KAIZEN_PRIORITY_META[p];
                    const selected = values.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setValue('priority', p)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                          selected ? 'border-current' : 'border-transparent'
                        }`}
                        style={{
                          color: meta.color,
                          backgroundColor: selected ? meta.bgColor : '#F9FAFB',
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Area / Machine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <div className="flex gap-3 mb-2">
                  {(['area', 'machine'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        {...register('areaType')}
                        value={type}
                        className="text-blue-600"
                      />
                      <span className="text-sm capitalize">{type === 'machine' ? 'Specific Machine' : 'General Area'}</span>
                    </label>
                  ))}
                </div>
                {values.areaType === 'machine' ? (
                  <input
                    {...register('machineName')}
                    placeholder="Machine name or ID"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <input
                    {...register('area')}
                    placeholder="Department or zone (e.g. Assembly Line 3)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Before photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Before Photos <span className="text-gray-400">(optional)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-blue-400 transition-colors w-fit">
                  <Camera size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {uploadingPhoto ? 'Uploading...' : 'Add photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                </label>
                {beforePhotos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {beforePhotos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Step 1: Solution ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suggested Solution <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('suggestedSolution')}
                  rows={4}
                  placeholder="Describe how you suggest fixing this..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.suggestedSolution && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.suggestedSolution.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Cost (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    {...register('estimatedCost', { valueAsNumber: true })}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Benefit (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    {...register('estimatedBenefit', { valueAsNumber: true })}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Add a tag..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    <Tag size={14} />
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {(values.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="hover:text-blue-900"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Here's how your Kaizen will appear on the board:
              </p>
              <div className="max-w-xs">
                <KaizenCardPreview
                  card={previewCard}
                  onClick={() => {}}
                  isProPlan={false}
                />
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <p className="font-medium mb-1">Summary</p>
                <p><span className="text-gray-500">Category:</span> {KAIZEN_CATEGORY_META[values.category ?? 'efficiency'].label}</p>
                <p><span className="text-gray-500">Priority:</span> {KAIZEN_PRIORITY_META[values.priority ?? 'medium'].label}</p>
                {values.estimatedCost != null && values.estimatedCost > 0 && (
                  <p><span className="text-gray-500">Est. Cost:</span> LKR {values.estimatedCost.toLocaleString()}</p>
                )}
                {values.estimatedBenefit != null && values.estimatedBenefit > 0 && (
                  <p><span className="text-gray-500">Monthly Benefit:</span> LKR {values.estimatedBenefit.toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer navigation */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          )}

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={submitting}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Kaizen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
