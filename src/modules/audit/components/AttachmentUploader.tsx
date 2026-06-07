import { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Video, X, Loader2, Paperclip } from 'lucide-react';
import { uploadAttachment } from '../services/audit.service';
import type { AuditAttachment, AttachmentType } from '../types/audit.types';

interface Props {
  plantId: string;
  sessionKey: string;
  attachments: AuditAttachment[];
  onChange: (next: AuditAttachment[]) => void;
}

const ACCEPT: Record<AttachmentType, string> = {
  document: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv',
  image: 'image/*,.heic,.webp',
  video: 'video/*,.mp4,.mov,.avi',
};

const TYPE_META: Record<AttachmentType, { label: string; icon: typeof FileText }> = {
  document: { label: 'Document', icon: FileText },
  image: { label: 'Image', icon: ImageIcon },
  video: { label: 'Video', icon: Video },
};

export function AttachmentUploader({ plantId, sessionKey, attachments, onChange }: Props) {
  const [uploading, setUploading] = useState<AttachmentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = {
    document: useRef<HTMLInputElement>(null),
    image: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
  };

  const handleFiles = async (type: AttachmentType, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(type);
    setError(null);
    try {
      const uploaded: AuditAttachment[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadAttachment(plantId, sessionKey, file, type));
      }
      onChange([...attachments, ...uploaded]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {(['document', 'image', 'video'] as AttachmentType[]).map((type) => {
          const Meta = TYPE_META[type];
          const Icon = Meta.icon;
          return (
            <div key={type}>
              <input
                ref={inputs[type]}
                type="file"
                multiple
                accept={ACCEPT[type]}
                className="hidden"
                onChange={(e) => handleFiles(type, e.target.files)}
              />
              <button
                type="button"
                disabled={uploading !== null}
                onClick={() => inputs[type].current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg disabled:opacity-50"
              >
                {uploading === type ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                Add {Meta.label}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {attachments.length === 0 ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Paperclip className="h-3.5 w-3.5" /> No supporting files attached
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => {
            const Icon = TYPE_META[a.type].icon;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-300 hover:underline truncate"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{a.name}</span>
                </a>
                <button
                  type="button"
                  onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
                  className="text-slate-500 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
