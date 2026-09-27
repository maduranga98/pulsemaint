import { useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import TermsDialog from './TermsDialog';

interface TermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Extra sentence shown before the link, e.g. the recurring-charge consent. */
  statement?: string;
  /** 'dark' inside the app shell, 'light' on the white registration card. */
  tone?: 'dark' | 'light';
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

/**
 * Required "I agree to the Terms of Service" tick box with a link that opens
 * the full terms in a pop-up window (not a new page), so the user can read
 * them without losing what they have filled in.
 */
export default function TermsCheckbox({ checked, onChange, statement, tone = 'dark', inputProps }: TermsCheckboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const text = tone === 'dark' ? 'text-slate-300!' : 'text-gray-700!';
  const link = tone === 'dark' ? 'text-blue-300!' : 'text-[#1A56DB]!';

  return (
    <>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-blue-600"
          {...inputProps}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={`text-sm leading-snug ${text}`}>
          {statement && <>{statement} </>}
          {t('common.legal.terms.agreePrefix')}{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            className={`font-medium underline hover:no-underline ${link}`}
          >
            {t('common.legal.terms.linkLabel')}
          </button>
          .
        </span>
      </label>
      {open && <TermsDialog onClose={() => setOpen(false)} onAccept={() => onChange(true)} />}
    </>
  );
}
