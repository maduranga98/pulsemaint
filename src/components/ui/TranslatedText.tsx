import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../lib/i18n';
import { translateForDisplay } from '../../lib/voiceTranslate';

interface TranslatedTextProps {
  text: string;
  className?: string;
  as?: 'span' | 'p';
}

/**
 * Renders `text` translated into whichever language the *current viewer*
 * has selected in the app's language switcher — not the language it was
 * originally typed or voice-dictated in. Re-translates automatically if
 * the viewer changes their language while looking at the page. Shows the
 * original text immediately and swaps in the translation once it resolves,
 * so there's no loading flicker for the common case where no Gemini key is
 * configured (translateForDisplay just returns the original text).
 */
export function TranslatedText({ text, className, as = 'span' }: TranslatedTextProps) {
  const { i18n } = useTranslation();
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let cancelled = false;
    setDisplay(text);
    translateForDisplay(text, i18n.language as AppLanguage).then((translated) => {
      if (!cancelled) setDisplay(translated);
    });
    return () => {
      cancelled = true;
    };
  }, [text, i18n.language]);

  const Tag = as;
  return <Tag className={className}>{display}</Tag>;
}
