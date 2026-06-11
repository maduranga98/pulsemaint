import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { addAssessment, deleteAssessment, COL } from '../../api';
import { useAuthStore } from '../../../../store/authStore';
import type { TriageAssessment, TriageCategory, TriageQuestion } from '../../types';

interface QuestionDraft {
  q: string;
  opts: [string, string, string, string];
  a: number;
}

function emptyQ(): QuestionDraft {
  return { q: '', opts: ['', '', '', ''], a: 0 };
}

export function AssessmentBuilder() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const uid = user?.uid ?? '';

  const [cats, setCats] = useState<TriageCategory[]>([]);
  const [assessments, setAssessments] = useState<TriageAssessment[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [catLabel, setCatLabel] = useState('');
  const [passMark, setPassMark] = useState(70);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQ()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const u1 = onSnapshot(
      query(
        collection(db, COL.categories),
        where('companyId', '==', companyId),
      ),
      (snap) =>
        setCats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageCategory))),
    );
    const u2 = onSnapshot(
      query(
        collection(db, COL.assessments),
        where('companyId', '==', companyId),
      ),
      (snap) =>
        setAssessments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageAssessment)),
        ),
    );
    return () => {
      u1();
      u2();
    };
  }, [companyId]);

  function updateQ(idx: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateOpt(qIdx: number, optIdx: number, val: string) {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.opts] as QuestionDraft['opts'];
        opts[optIdx] = val;
        return { ...q, opts };
      }),
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !catLabel.trim()) return;
    const validQs: TriageQuestion[] = questions
      .filter((q) => q.q.trim() && q.opts.some((o) => o.trim()))
      .map((q) => ({
        q: q.q.trim(),
        opts: q.opts.map((o) => o.trim()),
        a: q.a,
      }));
    if (!validQs.length) return;
    setSaving(true);
    try {
      await addAssessment(companyId, uid, {
        title: title.trim(),
        cat: catLabel,
        passMark,
        status: 'open',
        questions: validQs,
      });
      setTitle('');
      setCatLabel('');
      setPassMark(70);
      setQuestions([emptyQ()]);
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none';
  const inputStyle = {
    background: '#0e1628',
    border: '1px solid #1a2840',
    color: '#e2e8f0',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── LEFT: builder ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div
          className="rounded-xl p-4"
          style={{ background: '#111d2e', border: '1px solid #1a2840' }}
        >
          <div className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>
            New Assessment
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                Title *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={input}
                style={inputStyle}
                placeholder="e.g. Safety Lockout Procedure Quiz"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                  Category *
                </label>
                <select
                  value={catLabel}
                  onChange={(e) => setCatLabel(e.target.value)}
                  className={input}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  required
                >
                  <option value="">Select…</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.icon} {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                  Pass Mark (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={passMark}
                  onChange={(e) => setPassMark(Number(e.target.value))}
                  className={input}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="rounded-xl p-4"
                  style={{ background: '#0e1628', border: '1px solid #243450' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold" style={{ color: '#6b7fa3' }}>
                      Question {qIdx + 1}
                    </div>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((qs) => qs.filter((_, i) => i !== qIdx))
                        }
                        className="text-xs opacity-60 hover:opacity-100 transition-opacity"
                        style={{ color: '#ef4444' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    value={q.q}
                    onChange={(e) => updateQ(qIdx, { q: e.target.value })}
                    className={input + ' mb-3'}
                    style={inputStyle}
                    placeholder="Question text…"
                  />

                  <div className="space-y-2">
                    {q.opts.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${qIdx}`}
                          checked={q.a === oIdx}
                          onChange={() => updateQ(qIdx, { a: oIdx })}
                          className="shrink-0 accent-blue-500"
                          title="Mark as correct answer"
                        />
                        <input
                          value={opt}
                          onChange={(e) => updateOpt(qIdx, oIdx, e.target.value)}
                          className={input + ' flex-1'}
                          style={inputStyle}
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                        />
                        {q.a === oIdx && (
                          <span className="text-xs shrink-0" style={{ color: '#22c55e' }}>
                            ✓
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setQuestions((qs) => [...qs, emptyQ()])}
              className="w-full py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ background: '#1a2840', color: '#6b7fa3', border: '1px solid #243450' }}
            >
              + Add Question
            </button>

            <button
              type="submit"
              disabled={saving || !title.trim() || !catLabel.trim()}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: '#1d4ed8', color: 'white' }}
            >
              {saving ? 'Saving...' : '💾 Save Assessment'}
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: existing assessments ─────────────────────────────────── */}
      <div
        className="rounded-xl p-4"
        style={{ background: '#0e1628', border: '1px solid #1a2840' }}
      >
        <div className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>
          Existing Assessments ({assessments.length})
        </div>

        {assessments.length === 0 && (
          <div className="text-sm text-center py-10" style={{ color: '#3d5070' }}>
            No assessments created yet.
          </div>
        )}

        <div className="space-y-3">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: '#111d2e', border: '1px solid #1a2840' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
                  {a.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#6b7fa3' }}>
                  {a.cat} · {a.questions.length} questions · Pass {a.passMark}%
                </div>
                <div className="mt-1">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: a.status === 'open' ? '#22c55e1e' : '#6b7fa31e',
                      color: a.status === 'open' ? '#22c55e' : '#6b7fa3',
                    }}
                  >
                    {a.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteAssessment(a.id)}
                className="text-lg opacity-50 hover:opacity-100 transition-opacity shrink-0"
                title="Delete assessment"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
