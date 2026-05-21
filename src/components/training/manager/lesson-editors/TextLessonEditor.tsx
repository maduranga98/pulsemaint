import { useRef, useState } from 'react';
import { Eye, Code } from 'lucide-react';

interface TextLessonEditorProps {
  content?: string;
  onChange: (content: string) => void;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
}

interface ToolbarButtonProps {
  label: string;
  title: string;
  onClick: () => void;
}

function ToolbarButton({ label, title, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors border border-transparent hover:border-gray-200"
    >
      {label}
    </button>
  );
}

export default function TextLessonEditor({ content = '', onChange }: TextLessonEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPreview, setIsPreview] = useState(false);

  function wrapSelection(openTag: string, closeTag: string) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const before = content.slice(0, start);
    const after = content.slice(end);

    const newContent = `${before}${openTag}${selected}${closeTag}${after}`;
    onChange(newContent);

    // Restore cursor/selection after React re-render
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const newCursorStart = start + openTag.length;
      const newCursorEnd = end + openTag.length;
      el.setSelectionRange(newCursorStart, newCursorEnd);
    });
  }

  function insertBlock(template: string) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const before = content.slice(0, start);
    const after = content.slice(start);

    // Add newline before block if not at start of line
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const newContent = `${before}${needsNewline ? '\n' : ''}${template}${after}`;
    onChange(newContent);

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const insertPos = start + (needsNewline ? 1 : 0) + template.length;
      el.setSelectionRange(insertPos, insertPos);
    });
  }

  return (
    <div className="flex flex-col gap-2 border border-gray-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        {!isPreview && (
          <>
            <ToolbarButton label="B" title="Bold" onClick={() => wrapSelection('<strong>', '</strong>')} />
            <ToolbarButton label="I" title="Italic" onClick={() => wrapSelection('<em>', '</em>')} />
            <ToolbarButton label="H2" title="Heading 2" onClick={() => insertBlock('<h2>Heading</h2>')} />
            <ToolbarButton label="H3" title="Heading 3" onClick={() => insertBlock('<h3>Heading</h3>')} />
            <ToolbarButton label="•" title="Bullet List" onClick={() => insertBlock('<ul>\n  <li>Item</li>\n</ul>')} />
            <ToolbarButton label="1." title="Numbered List" onClick={() => insertBlock('<ol>\n  <li>Item</li>\n</ol>')} />
            <div className="w-px h-4 bg-gray-200 mx-1" />
          </>
        )}
        <button
          type="button"
          onClick={() => setIsPreview((p) => !p)}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors border ${
            isPreview
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent hover:border-gray-200'
          }`}
        >
          {isPreview ? (
            <>
              <Code size={12} />
              Edit
            </>
          ) : (
            <>
              <Eye size={12} />
              Preview
            </>
          )}
        </button>
      </div>

      {/* Editor or preview */}
      {isPreview ? (
        <div
          className="prose prose-sm max-w-none p-4 min-h-[200px] text-sm text-gray-800"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write lesson content here… Use the toolbar to format text, or write HTML directly."
          className="p-4 text-sm text-gray-800 placeholder-gray-400 resize-y min-h-[200px] focus:outline-none font-mono"
          spellCheck={false}
        />
      )}
    </div>
  );
}
