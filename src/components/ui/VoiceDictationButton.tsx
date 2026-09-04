import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import i18n from '../../lib/i18n';
import type { AppLanguage } from '../../lib/i18n';
import { translateSpokenText } from '../../lib/voiceTranslate';

// Minimal shape of the Web Speech API's SpeechRecognition, which lacks
// official TypeScript lib types and is vendor-prefixed in some browsers.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface VoiceDictationButtonProps {
  /** Called with the translated (or raw, if translation is unavailable) text each time speech is finalized. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  /**
   * Speech recognition locale — defaults to the device/browser's own
   * language so the speaker can talk in whatever language they naturally
   * use. The transcript is then auto-translated into the app's currently
   * selected display language (see src/lib/i18n.ts) before being handed
   * to onTranscript, so the "what happened" field always ends up in the
   * language the app is set to, regardless of what language was spoken.
   */
  lang?: string;
}

/**
 * Tap-to-talk mic button. Listens in the speaker's own language, then
 * translates the recognized speech into the app's active UI language
 * (via Gemini) and appends it to whatever field it's paired with by
 * calling onTranscript, so callers just do setValue(prev => prev + text).
 */
export function VoiceDictationButton({ onTranscript, disabled, className = '', lang }: VoiceDictationButtonProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [translating, setTranslating] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    // Let the browser recognize the speaker's own spoken language by
    // default (their device/browser locale) rather than forcing English —
    // translation into the app's display language happens afterward.
    recognition.lang = lang ?? navigator.language ?? 'en-US';

    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        }
      }
      const spoken = finalText.trim();
      if (!spoken) return;

      const targetLanguage = i18n.language as AppLanguage;
      setTranslating(true);
      translateSpokenText(spoken, targetLanguage)
        .then((translated) => onTranscript(translated))
        .finally(() => setTranslating(false));
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [lang, onTranscript]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled || translating}
      title={listening ? 'Stop recording' : translating ? 'Translating…' : 'Tap to speak — say it in any language'}
      aria-pressed={listening}
      className={`inline-flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        listening
          ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 animate-pulse'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      } ${className}`}
    >
      {listening ? (
        <Square className="w-4 h-4" />
      ) : translating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
}
