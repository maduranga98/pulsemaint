import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';

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
  /** Called with the appended transcript text each time speech is finalized. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  lang?: string;
}

/**
 * Tap-to-talk mic button. Appends recognized speech to whatever field it's
 * paired with by calling onTranscript as final results come in, so callers
 * just do setValue(prev => prev + text).
 */
export function VoiceDictationButton({ onTranscript, disabled, className = '', lang = 'en-US' }: VoiceDictationButtonProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
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
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        }
      }
      if (finalText.trim()) {
        onTranscript(finalText.trim());
      }
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
      disabled={disabled}
      title={listening ? 'Stop recording' : 'Tap to speak'}
      aria-pressed={listening}
      className={`inline-flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        listening
          ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 animate-pulse'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      } ${className}`}
    >
      {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
