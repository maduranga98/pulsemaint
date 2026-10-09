import { useEffect, useId, useMemo, useState } from 'react';
import { countryLabel, countryOptions, resolveCountry } from '@/lib/countries';

/**
 * Country picker that also accepts typing: suggests every country (named in
 * `lang`), stores the ISO code when the text matches one, otherwise stores
 * the country exactly as typed.
 */
export default function CountryInput({ value, onChange, lang = 'en', className, placeholder, onBlur, name }: {
  value: string;
  onChange: (value: string) => void;
  lang?: string;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
  name?: string;
}) {
  const listId = useId();
  const options = useMemo(() => countryOptions(lang), [lang]);
  const [text, setText] = useState(() => countryLabel(value, lang));

  // Follow outside changes (form reset, language switch) without fighting the user's typing.
  useEffect(() => {
    setText((current) => (resolveCountry(current, lang) === value ? countryLabel(value, lang) || current : countryLabel(value, lang)));
  }, [value, lang]);

  return (
    <>
      <input
        name={name}
        className={className}
        list={listId}
        value={text}
        placeholder={placeholder}
        autoComplete="country-name"
        onChange={(e) => {
          setText(e.target.value);
          onChange(resolveCountry(e.target.value, lang));
        }}
        onBlur={() => {
          const resolved = resolveCountry(text, lang);
          setText(countryLabel(resolved, lang));
          onBlur?.();
        }}
      />
      <datalist id={listId}>
        {options.map((c) => <option key={c.code} value={c.name} />)}
      </datalist>
    </>
  );
}
