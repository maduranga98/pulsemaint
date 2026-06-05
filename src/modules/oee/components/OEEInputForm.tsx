import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Zap, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/authStore';
import { saveOEERecord, calculateOEE, calculateAvailability, calculatePerformance, calculateQuality, autoFeedDowntime } from '../services/oee.service';
import type { OEEShift } from '../types/oee.types';
import { getOEEColor } from '../types/oee.types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  machineId: z.string().min(1, 'Machine is required'),
  machineName: z.string().min(1),
  department: z.string().optional(),
  shiftDate: z.string().min(1, 'Date is required'),
  shift: z.enum(['day', 'evening', 'night']),
  plannedProductionTime: z.number().positive('Must be > 0'),
  actualDowntime: z.number().min(0),
  actualOutput: z.number().min(0),
  targetOutput: z.number().positive('Must be > 0'),
  goodOutput: z.number().min(0),
  totalOutput: z.number().positive('Must be > 0'),
}).refine((d) => d.actualDowntime <= d.plannedProductionTime, {
  message: 'Downtime cannot exceed planned time',
  path: ['actualDowntime'],
}).refine((d) => d.goodOutput <= d.totalOutput, {
  message: 'Good output cannot exceed total output',
  path: ['goodOutput'],
});

type FormValues = z.infer<typeof schema>;

// ─── Live OEE Preview ─────────────────────────────────────────────────────────

function OEEPreview({ availability, performance, quality }: {
  availability: number; performance: number; quality: number;
}) {
  const oee = calculateOEE(availability, performance, quality);
  const color = getOEEColor(oee);

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-3 font-medium">Live OEE Preview</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Availability', val: availability, color: '#10B981' },
          { label: 'Performance', val: performance, color: '#1A56DB' },
          { label: 'Quality', val: quality, color: '#8B5CF6' },
          { label: 'OEE', val: oee, color },
        ].map(({ label, val, color: c }) => (
          <div key={label} className="space-y-0.5">
            <p className="text-xl font-bold font-sora" style={{ color: c }}>
              {isNaN(val) ? '—' : val}%
            </p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700 text-center">
        <p className="text-xs font-mono text-slate-400">
          <span style={{ color: '#10B981' }}>{isNaN(availability) ? '?' : availability}%</span>
          {' × '}
          <span style={{ color: '#1A56DB' }}>{isNaN(performance) ? '?' : performance}%</span>
          {' × '}
          <span style={{ color: '#8B5CF6' }}>{isNaN(quality) ? '?' : quality}%</span>
          {' = '}
          <span style={{ color }} className="font-bold">{isNaN(oee) ? '?' : oee}%</span>
        </p>
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface OEEInputFormProps {
  prefillMachineId?: string;
  prefillMachineName?: string;
  onSuccess?: () => void;
  isProPlan?: boolean;
}

export function OEEInputForm({ prefillMachineId, prefillMachineName, onSuccess, isProPlan }: OEEInputFormProps) {
  const user = useAuthStore((s) => s.user);
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [autoFilling, setAutoFilling] = useState(false);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      machineId: prefillMachineId ?? '',
      machineName: prefillMachineName ?? '',
      shiftDate: new Date().toISOString().slice(0, 10),
      shift: 'day',
      plannedProductionTime: 480,
      actualDowntime: 0,
      actualOutput: 0,
      targetOutput: 0,
      goodOutput: 0,
      totalOutput: 0,
    },
  });

  // Live OEE calculation
  const [planned, downtime, actualOut, targetOut, goodOut, totalOut] = watch([
    'plannedProductionTime', 'actualDowntime', 'actualOutput', 'targetOutput', 'goodOutput', 'totalOutput',
  ]);

  const availability = calculateAvailability(planned ?? 0, downtime ?? 0);
  const performance = calculatePerformance(actualOut ?? 0, targetOut ?? 0);
  const quality = calculateQuality(goodOut ?? 0, totalOut ?? 0);

  async function handleAutoFill() {
    if (!plantId) return;
    const machineId = watch('machineId');
    const shiftDate = watch('shiftDate');
    const shift = watch('shift') as OEEShift;
    if (!machineId || !shiftDate) {
      toast.error('Select a machine and date first');
      return;
    }
    setAutoFilling(true);
    try {
      const { totalMinutes, linkedIds: ids } = await autoFeedDowntime(plantId, machineId, shiftDate, shift);
      setValue('actualDowntime', totalMinutes, { shouldValidate: true });
      setLinkedIds(ids);
      toast.success(`Auto-filled ${totalMinutes} min downtime from ${ids.length} work order(s)`);
    } catch {
      toast.error('Failed to fetch breakdown data');
    } finally {
      setAutoFilling(false);
    }
  }

  async function onSubmit(values: FormValues) {
    if (!plantId || !user) return;
    setSubmitting(true);
    try {
      const avail = calculateAvailability(values.plannedProductionTime, values.actualDowntime);
      const perf = calculatePerformance(values.actualOutput, values.targetOutput);
      const qual = calculateQuality(values.goodOutput, values.totalOutput);
      const oee = calculateOEE(avail, perf, qual);

      await saveOEERecord(plantId, {
        machineId: values.machineId,
        machineName: values.machineName,
        shiftDate: values.shiftDate,
        shift: values.shift,
        plannedProductionTime: values.plannedProductionTime,
        actualDowntime: values.actualDowntime,
        actualOutput: values.actualOutput,
        targetOutput: values.targetOutput,
        goodOutput: values.goodOutput,
        totalOutput: values.totalOutput,
        availability: avail,
        performance: perf,
        quality: qual,
        oee,
        dataSource: linkedIds.length > 0 ? 'semi-auto' : 'manual',
        linkedBreakdownIds: linkedIds,
        enteredBy: user.uid,
        plantId,
        department: values.department,
      });

      toast.success(`OEE saved — ${oee}%`, {
        description: `A: ${avail}% · P: ${perf}% · Q: ${qual}%`,
      });
      onSuccess?.();
    } catch (e) {
      toast.error('Failed to save OEE record');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors';
  const labelCls = 'block text-xs text-slate-400 mb-1 font-medium';
  const errCls = 'text-xs text-red-400 mt-1';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Machine */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Machine ID *</label>
          <input {...register('machineId')} className={inputCls} placeholder="e.g. MCH-001" />
          {errors.machineId && <p className={errCls}>{errors.machineId.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Machine Name *</label>
          <input {...register('machineName')} className={inputCls} placeholder="e.g. CNC Lathe #3" />
          {errors.machineName && <p className={errCls}>{errors.machineName.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelCls}>Department</label>
        <input {...register('department')} className={inputCls} placeholder="e.g. Machining" />
      </div>

      {/* Date + Shift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Shift Date *</label>
          <input type="date" {...register('shiftDate')} className={inputCls} />
          {errors.shiftDate && <p className={errCls}>{errors.shiftDate.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Shift *</label>
          <select {...register('shift')} className={inputCls}>
            <option value="day">Day</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
          </select>
        </div>
      </div>

      {/* Production Time */}
      <div>
        <label className={labelCls}>Planned Production Time (minutes) *</label>
        <input
          type="number"
          {...register('plannedProductionTime', { valueAsNumber: true })}
          className={inputCls}
          placeholder="480"
        />
        {errors.plannedProductionTime && <p className={errCls}>{errors.plannedProductionTime.message}</p>}
      </div>

      {/* Downtime */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls + ' !mb-0'}>Actual Downtime (minutes) *</label>
          {isProPlan && (
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={autoFilling}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
            >
              {autoFilling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Auto-fill from Breakdown Records
            </button>
          )}
          {!isProPlan && (
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <Info className="h-3 w-3" />
              Factory Pro: auto-feed
            </span>
          )}
        </div>
        <input
          type="number"
          {...register('actualDowntime', { valueAsNumber: true })}
          className={inputCls}
          placeholder="0"
        />
        {errors.actualDowntime && <p className={errCls}>{errors.actualDowntime.message}</p>}
        {linkedIds.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Linked to {linkedIds.length} work order(s)
          </div>
        )}
      </div>

      {/* Output */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Actual Output *</label>
          <input
            type="number"
            {...register('actualOutput', { valueAsNumber: true })}
            className={inputCls}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Target Output *</label>
          <input
            type="number"
            {...register('targetOutput', { valueAsNumber: true })}
            className={inputCls}
            placeholder="0"
          />
          {errors.targetOutput && <p className={errCls}>{errors.targetOutput.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Good Output *</label>
          <input
            type="number"
            {...register('goodOutput', { valueAsNumber: true })}
            className={inputCls}
            placeholder="0"
          />
          {errors.goodOutput && <p className={errCls}>{errors.goodOutput.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Total Output *</label>
          <input
            type="number"
            {...register('totalOutput', { valueAsNumber: true })}
            className={inputCls}
            placeholder="0"
          />
          {errors.totalOutput && <p className={errCls}>{errors.totalOutput.message}</p>}
        </div>
      </div>

      {/* Live Preview */}
      <OEEPreview availability={availability} performance={performance} quality={quality} />

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? 'Saving…' : 'Save OEE Record'}
      </button>
    </form>
  );
}
