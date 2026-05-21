import { useState } from 'react';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import { CheckCircle, XCircle, Loader2, ClipboardCheck } from 'lucide-react';

interface PracticalSignOffCardProps {
  assignment: TrainingAssignment;
  onSignOff: (data: { passed: boolean; observations: string }) => Promise<void>;
  isLoading?: boolean;
}

export default function PracticalSignOffCard({
  assignment,
  onSignOff,
  isLoading = false,
}: PracticalSignOffCardProps) {
  const [observations, setObservations] = useState('');
  const [passed, setPassed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!observations.trim() || observations.trim().length < 10) {
      setError('Observations must be at least 10 characters.');
      return;
    }
    if (passed === null) {
      setError('Please select Pass or Fail.');
      return;
    }

    setSubmitting(true);
    try {
      await onSignOff({ passed, observations: observations.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-off failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Practical Sign-Off</h3>
          <p className="text-sm text-gray-500">
            {assignment.traineeName} &middot; {assignment.moduleName}
          </p>
        </div>
      </div>

      {/* Quiz Score */}
      <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-600">Quiz Score</span>
        <span className="text-lg font-bold text-gray-900">
          {assignment.bestScore}%
        </span>
      </div>

      {/* Observations */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observations <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={4}
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Describe what was observed during the practical assessment (min. 10 characters)..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          {observations.trim().length} / 10 min characters
        </p>
      </div>

      {/* Pass / Fail Selection */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Assessment Result <span className="text-red-500">*</span>
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPassed(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
              passed === true
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            Pass
          </button>
          <button
            type="button"
            onClick={() => setPassed(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
              passed === false
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
            }`}
          >
            <XCircle className="w-5 h-5" />
            Fail
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(submitting || isLoading) && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        Sign Off
      </button>
    </div>
  );
}
