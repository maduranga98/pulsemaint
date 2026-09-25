import { useRef } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StaffRequestAttachment } from '@/types/staffRequest';
import { fmtSize, MAX_ATTACHMENT_BYTES } from '../requestUi';

/** File chooser that keeps a local list of picked files (uploaded on submit). */
export function AttachmentPicker({
  files,
  onChange,
  onRejected,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  onRejected?: (name: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    Array.from(list).forEach((f) => {
      if (f.size > MAX_ATTACHMENT_BYTES) onRejected?.(f.name);
      else accepted.push(f);
    });
    onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E3A5F] px-3 py-1.5 text-xs font-medium text-[#B8C7DB] hover:border-[#2E5A8F] disabled:opacity-60"
      >
        <Paperclip className="h-3.5 w-3.5" /> {t('common.staffRequests.attachments.add')}
      </button>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#142849] px-2.5 py-1 text-xs text-[#D5DEEA]">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-[#8BA3BF]">{fmtSize(f.size)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={t('common.staffRequests.attachments.remove', { name: f.name })}
                className="shrink-0 text-[#8BA3BF] hover:text-[#F0F4F8]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Uploaded attachments as download links. */
export function AttachmentList({ attachments }: { attachments: StaffRequestAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={a.id}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#142849] px-2.5 py-1 text-xs text-[#93C5FD] hover:underline"
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{a.name}</span>
            <span className="shrink-0 text-[#8BA3BF]">{fmtSize(a.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
