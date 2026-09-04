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

// The Web Speech API cannot auto-detect the spoken language — it only
// recognizes correctly when told the right BCP-47 code up front, and
// defaulting to the browser's UI locale (usually en-US) mangles or drops
// speech in Sinhala, Tamil, and other languages entirely. So the speaker
// picks their language here; recognition uses exactly that code, and the
// transcript is then translated into the app's selected display language.
const VOICE_INPUT_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'si-LK', label: 'Sinhala (සිංහල)' },
  { code: 'ta-LK', label: 'Tamil (தமிழ்)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { code: 'ur-PK', label: 'Urdu (اردو)' },
  { code: 'bn-BD', label: 'Bengali (বাংলা)' },
  { code: 'ar-SA', label: 'Arabic (العربية)' },
  { code: 'zh-CN', label: 'Chinese (中文)' },
  { code: 'ja-JP', label: 'Japanese (日本語)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
] as const;

const VOICE_LANG_STORAGE_KEY = 'firmicore-voice-input-lang';

function getStoredVoiceLang(): string {
  try {
    const stored = localStorage.getItem(VOICE_LANG_STORAGE_KEY);
    if (stored && VOICE_INPUT_LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return 'en-US';
}

interface VoiceDictationButtonProps {
  /** Called with the translated (or raw, if translation is unavailable) text each time speech is finalized. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Tap-to-talk mic button with a spoken-language picker. Recognizes speech
 * in whichever language the speaker selects (Sinhala, Tamil, English, etc.),
 * then translates the recognized speech into the app's active UI language
 * (via Gemini) and appends it to whatever field it's paired with by
 * calling onTranscript, so callers just do setValue(prev => prev + text).
 */
export function VoiceDictationButton({ onTranscript, disabled, className = '' }: VoiceDictationButtonProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [voiceLang, setVoiceLang] = useState(getStoredVoiceLang);
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
    recognition.lang = voiceLang;

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
      translateSpokenText(spoken, targetLanguage, voiceLang)
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
  }, [voiceLang, onTranscript]);

  const handleLangChange = (code: string) => {
    setVoiceLang(code);
    try {
      localStorage.setItem(VOICE_LANG_STORAGE_KEY, code);
    } catch {
      // ignore — persistence is a convenience, not a requirement.
    }
  };

  if (!supported) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <select
        value={voiceLang}
        onChange={(e) => handleLangChange(e.target.value)}
        disabled={disabled || listening || translating}
        title="Language you'll speak in"
        aria-label="Language you'll speak in"
        className="text-xs px-1.5 py-1 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {VOICE_INPUT_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled || translating}
        title={listening ? 'Stop recording' : translating ? 'Translating…' : 'Tap to speak'}
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
    </div>
  );
}
