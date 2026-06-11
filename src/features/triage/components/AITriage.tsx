import { useState, useEffect, useRef } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { callTriageAssist } from '../api';
import type { AITriageResponse } from '../types';

const STARTERS = [
  'Hydraulic pump losing pressure after 2 hours',
  'Machine vibrating excessively during operation',
  'Conveyor belt slipping under load',
  'Temperature alarm keeps triggering',
  'Unusual noise from gearbox during startup',
];

export function AITriage() {
  const [situation, setSituation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AITriageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ wos: 0, bds: 0, audits: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadCounts() {
      try {
        const [w, b, a] = await Promise.all([
          getCountFromServer(collection(db, 'workOrders')),
          getCountFromServer(collection(db, 'breakdowns')),
          getCountFromServer(collection(db, 'audits')),
        ]);
        setCounts({
          wos: w.data().count,
          bds: b.data().count,
          audits: a.data().count,
        });
      } catch {
        // ignore count errors silently
      }
    }
    loadCounts();
  }, []);

  async function handleSubmit() {
    if (!situation.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callTriageAssist(situation.trim());
      setResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'AI Triage is unavailable. Try again later.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleStarter(s: string) {
    setSituation(s);
    textareaRef.current?.focus();
  }

  function handleReset() {
    setResult(null);
    setSituation('');
    setError(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + source pills */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🤖</span>
          <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>
            AI Triage Assistant
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: `${counts.wos} WOs`, color: '#3b82f6' },
            { label: `${counts.bds} breakdowns`, color: '#f97316' },
            { label: `${counts.audits} audits`, color: '#a78bfa' },
          ].map((p) => (
            <span
              key={p.label}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: p.color + '1e',
                color: p.color,
                border: `1px solid ${p.color}33`,
              }}
            >
              {p.label} analysing
            </span>
          ))}
        </div>
      </div>

      {/* Starters */}
      {!result && !loading && (
        <div>
          <div className="text-xs mb-2" style={{ color: '#6b7fa3' }}>
            Suggested situations:
          </div>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => handleStarter(s)}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  background: '#1a2840',
                  border: '1px solid #243450',
                  color: '#6b7fa3',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = '#e2e8f0')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = '#6b7fa3')
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && <AIResult result={result} onReset={handleReset} />}

      {/* Input */}
      {!result && (
        <div
          className="rounded-xl p-4"
          style={{ background: '#111d2e', border: '1px solid #1a2840' }}
        >
          <textarea
            ref={textareaRef}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe the machine fault or situation..."
            rows={3}
            disabled={loading}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder-[#3d5070]"
            style={{ color: '#e2e8f0' }}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs" style={{ color: '#3d5070' }}>
              Press Enter or click Analyse
            </span>
            <button
              onClick={handleSubmit}
              disabled={!situation.trim() || loading}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: '#a78bfa', color: 'white' }}
            >
              {loading ? 'Analysing...' : '🔍 Analyse'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-xl text-sm"
          style={{
            background: '#ef444414',
            border: '1px solid #ef444430',
            color: '#ef4444',
          }}
        >
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

function AIResult({
  result,
  onReset,
}: {
  result: AITriageResponse;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="p-4 rounded-xl"
        style={{ background: '#a78bfa14', border: '1px solid #a78bfa30' }}
      >
        <div className="text-sm font-semibold mb-1" style={{ color: '#a78bfa' }}>
          Summary
        </div>
        <div className="text-sm" style={{ color: '#e2e8f0' }}>
          {result.summary}
        </div>
      </div>

      <AISection title="Likely Causes" items={result.likelyCauses} color="#f97316" icon="🔍" />
      <AISection title="Check Now" items={result.checkNow} color="#fbbf24" icon="⚡" />
      <AISection title="Safe Actions" items={result.safeActions} color="#22c55e" icon="✅" />
      <AISection title="Do NOT" items={result.doNot} color="#ef4444" icon="🚫" />

      {result.basedOn && (
        <div
          className="text-xs p-3 rounded-lg"
          style={{
            background: '#1a2840',
            color: '#6b7fa3',
            border: '1px solid #243450',
          }}
        >
          Based on: {result.basedOn}
        </div>
      )}

      <button
        onClick={onReset}
        className="text-sm px-4 py-2 rounded-xl transition-colors"
        style={{
          background: '#1a2840',
          color: '#6b7fa3',
          border: '1px solid #243450',
        }}
      >
        ← New Query
      </button>
    </div>
  );
}

function AISection({
  title,
  items,
  color,
  icon,
}: {
  title: string;
  items: string[];
  color: string;
  icon: string;
}) {
  if (!items?.length) return null;
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: color + '0d', border: `1px solid ${color}25` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-sm font-semibold" style={{ color }}>
          {title}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm"
            style={{ color: '#e2e8f0' }}
          >
            <span className="mt-0.5 shrink-0" style={{ color }}>
              •
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
