import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Trash2 } from 'lucide-react';
import { formatDuration, pickRecordingMime, type CallRecordingInfo } from '@/lib/platform/callRecording';
import { uploadCallRecording } from '@/services/platformCallRecordings';
import { btn } from '../platformUi';

export interface RecordedCall {
  recording: CallRecordingInfo;
}

/**
 * Records the call from the microphone (put the phone on speaker) and saves
 * the audio. Nothing is transcribed or translated: the person types what was
 * said in the call note. The parent stores the audio with the call log, so it
 * stays on the lead's profile.
 */
export default function CallRecorder({ leadId, value, onChange }: {
  leadId: string;
  value: RecordedCall | null;
  onChange: (v: RecordedCall | null) => void;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
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
    onChange({ recording: info });
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
        {state === 'processing' && (
          <span className="inline-flex items-center gap-1.5 text-xs text-sky-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving the recording…
          </span>
        )}
      </div>

      {state === 'idle' && !value && (
        <p className="text-xs text-slate-500">Put the call on speaker and record it. When you stop, the audio is saved with this call. Then type what they said below.</p>
      )}

      {value && state !== 'processing' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <audio controls src={value.recording.url} className="h-9 w-full min-w-0" />
            <button type="button" title="Discard recording" aria-label="Discard recording" onClick={() => onChange(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400">{formatDuration(value.recording.durationSec)}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
