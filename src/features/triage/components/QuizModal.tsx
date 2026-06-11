import { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { writeAssessmentResult } from '../api';
import type { TriageAssessment } from '../types';

interface Props {
  assessment: TriageAssessment;
  onClose: () => void;
}

export function QuizModal({ assessment, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);

  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(assessment.questions.length).fill(null),
  );
  const [answered, setAnswered] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const q = assessment.questions[currentQ];
  const totalQ = assessment.questions.length;
  const score = answers.filter((a, i) => a === assessment.questions[i]?.a).length;
  const pct = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
  const passed = pct >= assessment.passMark;

  function handleSelect(idx: number) {
    if (answered) return;
    setSelectedOpt(idx);
    setAnswered(true);
    const next = [...answers];
    next[currentQ] = idx;
    setAnswers(next);
  }

  async function handleNext() {
    if (currentQ < totalQ - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedOpt(null);
      setAnswered(false);
    } else {
      setShowResults(true);
      if (!saved) {
        setSaving(true);
        try {
          await writeAssessmentResult(
            userProfile?.companyId ?? '',
            user?.uid ?? '',
            { assessmentId: assessment.id, score, total: totalQ, passed },
          );
          setSaved(true);
        } catch (e) {
          console.error('Failed to save result', e);
        } finally {
          setSaving(false);
        }
      }
    }
  }

  function optStyle(idx: number): React.CSSProperties {
    if (!answered) {
      return { background: '#1a2840', border: '1px solid #243450', color: '#e2e8f0' };
    }
    if (idx === q.a) {
      return { background: '#22c55e14', border: '1px solid #22c55e', color: '#22c55e' };
    }
    if (idx === selectedOpt) {
      return { background: '#ef444414', border: '1px solid #ef4444', color: '#ef4444' };
    }
    return { background: '#1a2840', border: '1px solid #1a2840', color: '#6b7fa3' };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#0e1628', border: '1px solid #1a2840' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #1a2840' }}
        >
          <div>
            <div className="font-semibold" style={{ color: '#e2e8f0' }}>
              {assessment.title}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#6b7fa3' }}>
              {assessment.cat} · Pass mark: {assessment.passMark}%
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#6b7fa3' }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = '#1a2840')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {!showResults ? (
            <>
              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="flex-1 h-1.5 rounded-full"
                  style={{ background: '#1a2840' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${((currentQ + 1) / totalQ) * 100}%`,
                      background: '#3b82f6',
                    }}
                  />
                </div>
                <span className="text-xs shrink-0" style={{ color: '#6b7fa3' }}>
                  {currentQ + 1} / {totalQ}
                </span>
              </div>

              {/* Question */}
              <div className="text-sm font-medium mb-4" style={{ color: '#e2e8f0' }}>
                {q.q}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {q.opts.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    disabled={answered}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={optStyle(idx)}
                  >
                    <span className="font-semibold mr-2">
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    {opt}
                  </button>
                ))}
              </div>

              {answered && (
                <div className="mt-4 flex items-center justify-between">
                  <div
                    className="text-sm font-medium"
                    style={{ color: selectedOpt === q.a ? '#22c55e' : '#ef4444' }}
                  >
                    {selectedOpt === q.a ? '✓ Correct!' : '✗ Incorrect'}
                  </div>
                  <button
                    onClick={handleNext}
                    className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: '#1d4ed8', color: 'white' }}
                  >
                    {currentQ < totalQ - 1 ? 'Next →' : 'Finish'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div
                className="text-5xl font-bold mb-2"
                style={{ color: passed ? '#22c55e' : '#ef4444' }}
              >
                {pct}%
              </div>
              <div className="text-sm mb-5" style={{ color: '#6b7fa3' }}>
                {score} / {totalQ} correct · Pass mark {assessment.passMark}%
              </div>

              {passed ? (
                <div
                  className="flex flex-col items-center gap-2 p-4 rounded-xl mb-5"
                  style={{ background: '#22c55e14', border: '1px solid #22c55e40' }}
                >
                  <span className="text-3xl">🏆</span>
                  <div className="font-semibold" style={{ color: '#22c55e' }}>
                    Certificate Issued!
                  </div>
                  <div className="text-xs" style={{ color: '#6b7fa3' }}>
                    You passed {assessment.title}
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center gap-2 p-4 rounded-xl mb-5"
                  style={{ background: '#ef444414', border: '1px solid #ef444440' }}
                >
                  <span className="text-3xl">📚</span>
                  <div className="font-semibold" style={{ color: '#ef4444' }}>
                    Not Passed
                  </div>
                  <div className="text-xs" style={{ color: '#6b7fa3' }}>
                    Review the material and try again
                  </div>
                </div>
              )}

              {saving && (
                <div className="text-xs mb-3" style={{ color: '#6b7fa3' }}>
                  Saving result...
                </div>
              )}

              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: '#1d4ed8', color: 'white' }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
