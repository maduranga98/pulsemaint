import { useMemo, useRef, useState } from 'react';
import { Send, Pencil, Trash2, AtSign, X, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useComments } from '../../hooks/useComments';
import { useCompanyUsers, type CompanyUser } from '../../hooks/useCompanyUsers';
import type { CommentParentType, CommentMention } from '../../types/comments';

interface CommentThreadProps {
  parentType: CommentParentType;
  parentId: string;
  parentLink: string;
  parentLabel: string;
}

function timeAgo(ts: any): string {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return 'just now';
  return d.toLocaleString();
}

/** Highlights @mentions inside rendered comment text. */
function renderText(text: string) {
  const parts = text.split(/(@[\w.\- ]+?)(?=\s|$|[,.!?])/g);
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <span key={i} className="text-blue-600 font-medium">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function CommentThread({ parentType, parentId, parentLink, parentLabel }: CommentThreadProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { comments, loading, addComment, editComment, deleteComment } = useComments(
    parentType,
    parentId,
  );
  const { users } = useCompanyUsers(userProfile?.companyId);

  const [text, setText] = useState('');
  const [pendingMentions, setPendingMentions] = useState<CommentMention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.id !== userProfile?.id && u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, users, userProfile?.id]);

  function handleTextChange(value: string) {
    setText(value);
    // Detect an in-progress @mention token at the caret end.
    const match = /(?:^|\s)@([\w.\-]*)$/.exec(value);
    setMentionQuery(match ? match[1] : null);
  }

  function pickMention(user: CompanyUser) {
    // Replace the trailing "@query" with "@Name ".
    const replaced = text.replace(/(^|\s)@([\w.\-]*)$/, `$1@${user.name} `);
    setText(replaced);
    setMentionQuery(null);
    setPendingMentions((prev) =>
      prev.some((m) => m.userId === user.id) ? prev : [...prev, { userId: user.id, userName: user.name }],
    );
    textareaRef.current?.focus();
  }

  function resolveMentions(finalText: string): CommentMention[] {
    // Keep only mentions whose "@Name" token still appears in the text.
    return pendingMentions.filter((m) => finalText.includes(`@${m.userName}`));
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const ok = await addComment({
      text: trimmed,
      mentions: resolveMentions(trimmed),
      parentLink,
      parentLabel,
    });
    setSubmitting(false);
    if (ok) {
      setText('');
      setPendingMentions([]);
      setMentionQuery(null);
    }
  }

  async function saveEdit(id: string) {
    const ok = await editComment(id, editText);
    if (ok) {
      setEditingId(null);
      setEditText('');
    }
  }

  return (
    <div className="space-y-4">
      {/* Thread */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const isAuthor = c.authorId === userProfile?.id;
            const isEditing = editingId === c.id;
            return (
              <li key={c.id} className="flex gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                  {c.authorName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
                    <span className="text-[11px] text-gray-400">{timeAgo(c.createdAt)}</span>
                    {c.editedAt && !c.deleted && (
                      <span className="text-[11px] text-gray-300 italic">edited</span>
                    )}
                  </div>
                  {c.deleted ? (
                    <p className="text-sm text-gray-400 italic">Comment deleted</p>
                  ) : isEditing ? (
                    <div className="mt-1 space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {renderText(c.text)}
                    </p>
                  )}
                  {!c.deleted && !!c.attachmentUrls?.length && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.attachmentUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline"
                        >
                          Attachment {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  {isAuthor && !c.deleted && !isEditing && (
                    <div className="flex gap-3 mt-1">
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditText(c.text);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Composer */}
      <div className="relative border border-gray-200 rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-500">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          placeholder="Add a comment… use @ to mention a teammate"
          className="w-full text-sm outline-none resize-none"
        />

        {mentionQuery !== null && mentionMatches.length > 0 && (
          <div className="absolute left-2 bottom-12 z-20 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {mentionMatches.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => pickMention(u)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50"
              >
                <AtSign className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm text-gray-900">{u.name}</span>
                <span className="text-[11px] text-gray-400 ml-auto capitalize">
                  {u.role.replace(/_/g, ' ')}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-gray-400">⌘/Ctrl + Enter to send</span>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> {submitting ? 'Posting…' : 'Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
