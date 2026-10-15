import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Trash2 } from 'lucide-react';
import {
  CALL_LANGUAGES, canTranscribe, formatDuration, pickRecordingMime,
  type CallAnalysis, type CallRecordingInfo,
} from '@/lib/platform/callRecording';
import { transcribeCallRecording, uploadCallRecording } from '@/services/platformCallRecordings';
import { btn, input } from '../platformUi';

export interface RecordedCall {
  recording: CallRecordingInfo;
  analysis: CallAnalysis | null;
}

/**
 * Records the call from the microphone (put the phone on speaker), saves the
 * audio, and — once recording stops — transcribes it and summarises what the
 * customer needs in the language they spoke. The parent receives the result and
 * stores it with the call log, so the audio stays on the lead's profile.
 */
export default function CallRecorder({ leadId, value, onChange, onSummary }: {
  leadId: string;
  value: RecordedCall | null;
  onChange: (v: RecordedCall | null) => void;
  /** Called with the analysis so the parent can fill the call note. */
  onSummary: (a: CallAnalysis) => void;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [language, setLanguage] = useState('auto');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);

  const supported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const cleanup = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  // Release the microphone if the panel is closed mid-recording.
  useEffect(() => () => {
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    cleanup();
  }, []);

  async function start() {
    setError(null);
    setNotice(null);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
      stream.current = mic;
      const mime = pickRecordingMime((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(mic, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => void finish(rec.mimeType || mime || 'audio/webm');
      recorder.current = rec;
      startedAt.current = Date.now();
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
      rec.start(1000);
      setState('recording');
    } catch {
      cleanup();
      setError('Could not use the microphone — allow microphone access for this site and try again.');
    }
  }

  function stop() {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }

  async function finish(mime: string) {
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    cleanup();
    setState('processing');
    const blob = new Blob(chunks.current, { type: mime });
    let info: CallRecordingInfo;
    try {
      info = await uploadCallRecording(leadId, blob, mime, durationSec);
    } catch {
      setState('idle');
      setError('The recording could not be saved. Check your connection and record again.');
      return;
    }
    // The audio is safe from here on; transcription is best effort.
    let analysis: CallAnalysis | null = null;
    if (!canTranscribe(mime)) {
      setNotice('Audio saved. This browser records a format that can\'t be transcribed — use Chrome, Edge or Firefox for summaries.');
    } else {
      try {
        analysis = await transcribeCallRecording(leadId, info.path, language);
        if (!analysis.transcript) setNotice('Audio saved, but no speech was detected.');
        else onSummary(analysis);
      } catch (e) {
        setNotice(`Audio saved, but it could not be summarised${e instanceof Error && e.message ? ` (${e.message})` : ''}. You can still type the note.`);
      }
    }
    onChange({ recording: info, analysis });
    setState('idle');
  }

  if (!supported) {
    return <p className="text-xs text-amber-300">Voice recording isn't available in this browser.</p>;
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {state === 'recording' ? (
          <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
            <Square className="h-4 w-4" /> Stop · {formatDuration(seconds)}
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          </button>
        ) : (
          <button type="button" onClick={() => void start()} disabled={state === 'processing'} className={`${btn.ghost} inline-flex items-center gap-2`}>
            <Mic className="h-4 w-4 text-red-400" /> {value ? 'Record again' : 'Record call'}
          </button>
        )}
        <select
          className={`${input} !w-auto !py-1.5 text-xs`}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={state !== 'idle'}
          aria-label="Spoken language"
        >
          {CALL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        {state === 'processing' && (
          <span className="inline-flex items-center gap-1.5 text-xs text-sky-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving and summarising…
          </span>
        )}
      </div>

      {state === 'idle' && !value && (
        <p className="text-xs text-slate-500">Put the call on speaker and record it. When you stop, it's saved to this lead and the customer's needs are summarised in the language they spoke.</p>
      )}

      {value && state !== 'processing' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <audio controls src={value.recording.url} className="h-9 w-full min-w-0" />
            <button type="button" title="Discard recording" aria-label="Discard recording" onClick={() => onChange(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {value.analysis?.languageName && value.analysis.transcript && (
            <p className="text-xs text-slate-400">Detected language: <span className="text-slate-200">{value.analysis.languageName}</span> · {formatDuration(value.recording.durationSec)}</p>
          )}
        </div>
      )}

      {notice && <p className="text-xs text-amber-300">{notice}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
