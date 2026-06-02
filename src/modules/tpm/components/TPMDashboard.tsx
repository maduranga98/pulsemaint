import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useTPMScore } from '../hooks/useTPM';
import type { TPMPillar } from '../types/tpm.types';

// ─── Radial Gauge ─────────────────────────────────────────────────────────────

interface RadialGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function RadialGauge({ score, size = 180, strokeWidth = 14, label }: RadialGaugeProps) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  const color =
    animated >= 85 ? '#10B981' : animated >= 65 ? '#F59E0B' : '#EF4444';

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold font-sora text-white" style={{ color }}>
          {Math.round(animated)}
        </span>
        {label && <span className="text-xs text-slate-400 mt-1">{label}</span>}
      </div>
    </div>
  );
}

// ─── Mini Pillar Gauge ────────────────────────────────────────────────────────

function MiniGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  const size = 52;
  const sw = 6;
  const radius = (size - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const color = animated >= 85 ? '#10B981' : animated >= 65 ? '#F59E0B' : '#EF4444';

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>
        {Math.round(animated)}
      </span>
    </div>
  );
}

// ─── Pillar Score Bar ─────────────────────────────────────────────────────────

function PillarBar({ score }: { score: number }) {
  const [width, setWidth] = useState(0);
  const color = score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-500' : 'bg-red-500';

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 300);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ─── Pillar Chip ──────────────────────────────────────────────────────────────

function PillarChip({ score }: { score: number }) {
  if (score >= 85) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-900/50 text-emerald-400 border border-emerald-800">
        Strong
      </span>
    );
  }
  if (score >= 65) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-900/50 text-amber-400 border border-amber-800">
        Improving
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-900/50 text-red-400 border border-red-800">
      Needs Work
    </span>
  );
}

// ─── Trend Arrow ─────────────────────────────────────────────────────────────

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <span className="text-emerald-400 text-sm">↑</span>;
  if (trend === 'down') return <span className="text-red-400 text-sm">↓</span>;
  return <span className="text-slate-400 text-sm">→</span>;
}

// ─── Pillar Card ──────────────────────────────────────────────────────────────

function PillarCard({ pillar, index, onSelect }: { pillar: TPMPillar; index: number; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="group bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-left hover:border-blue-500/50 hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{pillar.icon}</span>
          <div>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
              {pillar.id}
            </p>
            <p className="text-xs text-slate-300 font-medium leading-tight">{pillar.name}</p>
          </div>
        </div>
        <MiniGauge score={pillar.score} />
      </div>

      <PillarBar score={pillar.score} />

      <div className="flex items-center justify-between mt-2.5">
        <PillarChip score={pillar.score} />
        <TrendArrow trend={pillar.trend} />
      </div>
    </button>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function PillarCardSkeleton() {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1.5">
          <div className="h-3 w-8 bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-slate-700 rounded" />
        </div>
        <div className="h-13 w-13 rounded-full bg-slate-700" />
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full" />
      <div className="flex justify-between mt-2.5">
        <div className="h-4 w-16 bg-slate-700 rounded" />
        <div className="h-4 w-4 bg-slate-700 rounded" />
      </div>
    </div>
  );
}

// ─── Upgrade Prompt ───────────────────────────────────────────────────────────

function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-8 flex flex-col items-center text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-blue-900/40 border border-blue-700/50 flex items-center justify-center">
        <Lock className="h-5 w-5 text-blue-400" />
      </div>
      <div>
        <p className="font-semibold text-white font-sora">{feature}</p>
        <p className="text-sm text-slate-400 mt-1">Available on Factory Pro plan</p>
      </div>
      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
        Upgrade to Factory Pro
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface TPMDashboardProps {
  onPillarSelect: (pillarId: string) => void;
  showMaturity?: boolean;
}

export function TPMDashboard({ onPillarSelect, showMaturity = false }: TPMDashboardProps) {
  const plan = useAuthStore((s) => s.company?.plan);
  const isProPlan = plan === 'enterprise';
  const { composite, pillars, loading, error, lastUpdated } = useTPMScore();

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-red-400 text-sm">
        Failed to load TPM data: {error}
      </div>
    );
  }

  const score = composite ?? 0;
  const isWorldClass = score >= 85;

  return (
    <div className="space-y-6">
      {/* Composite Score Hero */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            {loading ? (
              <div className="h-[180px] w-[180px] rounded-full bg-slate-700/50 animate-pulse" />
            ) : (
              <RadialGauge score={score} label="TPM Score" />
            )}
          </div>

          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <h2 className="text-2xl font-bold text-white font-sora">Overall TPM Score</h2>
              {isWorldClass && !loading && (
                <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 text-xs font-semibold rounded-full">
                  ⭐ World Class
                </span>
              )}
            </div>

            <p className="text-sm text-slate-400">
              {score >= 85
                ? 'Excellent. Your plant is operating at world-class TPM standards.'
                : score >= 65
                ? 'Good progress. Focus on lower-scoring pillars to reach world class.'
                : 'Significant improvement needed. Prioritise AM and PM pillars.'}
            </p>

            {lastUpdated && (
              <p className="text-xs text-slate-500">Last updated: {lastUpdated}</p>
            )}

            {/* Score band legend */}
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              {[
                { label: '< 65 — Critical', color: 'bg-red-500' },
                { label: '65–84 — Developing', color: 'bg-amber-500' },
                { label: '≥ 85 — World Class', color: 'bg-emerald-500' },
              ].map((band) => (
                <div key={band.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${band.color}`} />
                  {band.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 8 Pillar Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          8 TPM Pillars
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <PillarCardSkeleton key={i} />)
            : pillars.map((pillar, i) => (
                <PillarCard
                  key={pillar.id}
                  pillar={pillar}
                  index={i}
                  onSelect={() => onPillarSelect(pillar.id)}
                />
              ))}
        </div>
      </div>

      {/* Maturity Roadmap Gate */}
      {showMaturity && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Maturity Roadmap
          </h3>
          {isProPlan ? null : <UpgradePrompt feature="TPM Maturity Roadmap" />}
        </div>
      )}
    </div>
  );
}
