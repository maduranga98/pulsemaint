import { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import {
  addCategory,
  addContentItem,
  deleteCategory,
  uploadPdf,
  COL,
} from '../../api';
import { useAuthStore } from '../../../../store/authStore';
import type { TriageCategory, TriageContentType } from '../../types';
import { ContentList } from '../ContentList';

const COLOR_PRESETS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#a78bfa'];

type ContentType = TriageContentType;

interface ContentForm {
  categoryId: string;
  type: ContentType;
  title: string;
  meta: string;
  intro: string;
  stepsRaw: string;
  note: string;
  bodyRaw: string;
  videoUrl: string;
  pdfUrl: string;
}

const EMPTY_FORM: ContentForm = {
  categoryId: '',
  type: 'procedure',
  title: '',
  meta: '',
  intro: '',
  stepsRaw: '',
  note: '',
  bodyRaw: '',
  videoUrl: '',
  pdfUrl: '',
};

function extractVideoId(input: string): string {
  const m = input.match(/(?:v=|youtu\.be\/|embed\/)([^&\n?]+)/);
  return m ? m[1] : input.trim();
}

function parseSteps(raw: string) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf('|');
      if (sep === -1) return { t: line, d: '' };
      return { t: line.slice(0, sep).trim(), d: line.slice(sep + 1).trim() };
    });
}

function parseBody(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function ContentBuilder() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const uid = user?.uid ?? '';

  const [cats, setCats] = useState<TriageCategory[]>([]);
  const [previewCatId, setPreviewCatId] = useState<string>('');

  // Category form
  const [catIcon, setCatIcon] = useState('🔧');
  const [catTitle, setCatTitle] = useState('');
  const [catColor, setCatColor] = useState(COLOR_PRESETS[4]);
  const [catDesc, setCatDesc] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Content item form
  const [form, setForm] = useState<ContentForm>(EMPTY_FORM);
  const [itemSaving, setItemSaving] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      query(
        collection(db, COL.categories),
        where('companyId', '==', companyId),
        orderBy('pinned', 'desc'),
        orderBy('order', 'asc'),
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageCategory));
        setCats(list);
        if (list.length && !previewCatId) setPreviewCatId(list[0].id);
      },
    );
  }, [companyId]);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catTitle.trim()) return;
    setCatSaving(true);
    try {
      await addCategory(companyId, uid, {
        title: catTitle.trim(),
        icon: catIcon.trim().slice(0, 2) || '📁',
        color: catColor,
        desc: catDesc.trim(),
        pinned: false,
        order: cats.length,
      });
      setCatTitle('');
      setCatDesc('');
      setCatIcon('🔧');
    } finally {
      setCatSaving(false);
    }
  }

  async function handleAddContent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId || !form.title.trim()) return;
    setItemSaving(true);
    try {
      const base = {
        categoryId: form.categoryId,
        type: form.type,
        title: form.title.trim(),
        meta: form.meta.trim(),
        order: 0,
      };

      let extra: Record<string, unknown> = {};

      if (form.type === 'procedure') {
        extra = {
          intro: form.intro.trim(),
          steps: parseSteps(form.stepsRaw),
          note: form.note.trim(),
        };
      } else if (form.type === 'guide') {
        extra = { body: parseBody(form.bodyRaw) };
      } else if (form.type === 'video') {
        extra = { videoId: extractVideoId(form.videoUrl) };
      } else if (form.type === 'pdf') {
        let fileUrl = form.pdfUrl.trim();
        if (pdfFile) fileUrl = await uploadPdf(pdfFile);
        extra = { fileUrl };
      }

      await addContentItem(companyId, uid, { ...base, ...extra } as Parameters<typeof addContentItem>[2]);
      setForm({ ...EMPTY_FORM, categoryId: form.categoryId, type: form.type });
      setPdfFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setItemSaving(false);
    }
  }

  const input =
    'w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none';
  const inputStyle = {
    background: '#0e1628',
    border: '1px solid #1a2840',
    color: '#e2e8f0',
  };

  const previewCat = cats.find((c) => c.id === previewCatId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── LEFT: forms ─────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Category form */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#111d2e', border: '1px solid #1a2840' }}
        >
          <div className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>
            New Category
          </div>
          <form onSubmit={handleAddCategory} className="space-y-3">
            <div className="flex gap-2">
              <div style={{ flex: '0 0 72px' }}>
                <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                  Icon
                </label>
                <input
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                  maxLength={2}
                  className={input}
                  style={{ ...inputStyle, textAlign: 'center', fontSize: 20 }}
                  placeholder="🔧"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                  Title *
                </label>
                <input
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  className={input}
                  style={inputStyle}
                  placeholder="e.g. Safety & Emergency"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                Description
              </label>
              <input
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className={input}
                style={inputStyle}
                placeholder="Short description"
              />
            </div>
            <div>
              <label className="text-xs block mb-2" style={{ color: '#6b7fa3' }}>
                Colour
              </label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatColor(c)}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{
                      background: c,
                      boxShadow: catColor === c ? `0 0 0 2px #0e1628, 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={catSaving || !catTitle.trim()}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: '#1d4ed8', color: 'white' }}
            >
              {catSaving ? 'Adding...' : '+ Add Category'}
            </button>
          </form>
        </div>

        {/* Content item form */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#111d2e', border: '1px solid #1a2840' }}
        >
          <div className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>
            Add Content Item
          </div>
          <form onSubmit={handleAddContent} className="space-y-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                Category *
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className={input}
                style={{ ...inputStyle, cursor: 'pointer' }}
                required
              >
                <option value="">Select category…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                Type *
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(['procedure', 'guide', 'video', 'pdf'] as ContentType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className="py-2 rounded-lg text-xs font-medium transition-colors capitalize"
                    style={{
                      background: form.type === t ? '#1d4ed8' : '#1a2840',
                      color: form.type === t ? 'white' : '#6b7fa3',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                Title *
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={input}
                style={inputStyle}
                placeholder="e.g. Emergency Stop Procedure"
                required
              />
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                Meta / subtitle
              </label>
              <input
                value={form.meta}
                onChange={(e) => setForm((f) => ({ ...f, meta: e.target.value }))}
                className={input}
                style={inputStyle}
                placeholder="e.g. Procedure · 6 steps · CRITICAL"
              />
            </div>

            {/* Type-specific fields */}
            {form.type === 'procedure' && (
              <>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                    Introduction
                  </label>
                  <textarea
                    value={form.intro}
                    onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
                    rows={2}
                    className={input + ' resize-none'}
                    style={inputStyle}
                    placeholder="Brief explanation paragraph"
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                    Steps (one per line, format: Title | description)
                  </label>
                  <textarea
                    value={form.stepsRaw}
                    onChange={(e) => setForm((f) => ({ ...f, stepsRaw: e.target.value }))}
                    rows={4}
                    className={input + ' resize-none'}
                    style={inputStyle}
                    placeholder={`Isolate power | Switch off main breaker\nCheck for hazards | Look for leaks or sparks`}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                    Warning note (optional)
                  </label>
                  <input
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    className={input}
                    style={inputStyle}
                    placeholder="e.g. Do not restart without supervisor approval"
                  />
                </div>
              </>
            )}

            {form.type === 'guide' && (
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                  Body bullets (one per line)
                </label>
                <textarea
                  value={form.bodyRaw}
                  onChange={(e) => setForm((f) => ({ ...f, bodyRaw: e.target.value }))}
                  rows={4}
                  className={input + ' resize-none'}
                  style={inputStyle}
                  placeholder="Check oil level daily&#10;Replace filter every 500 hours"
                />
              </div>
            )}

            {form.type === 'video' && (
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
                  YouTube URL or Video ID
                </label>
                <input
                  value={form.videoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                  className={input}
                  style={inputStyle}
                  placeholder="https://youtube.com/watch?v=... or dQw4w9WgXcQ"
                />
              </div>
            )}

            {form.type === 'pdf' && (
              <div className="space-y-2">
                <label className="text-xs block" style={{ color: '#6b7fa3' }}>
                  Upload PDF or paste URL
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs"
                  style={{ color: '#6b7fa3' }}
                />
                <input
                  value={form.pdfUrl}
                  onChange={(e) => setForm((f) => ({ ...f, pdfUrl: e.target.value }))}
                  className={input}
                  style={inputStyle}
                  placeholder="Or paste a public PDF URL"
                  disabled={!!pdfFile}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={itemSaving || !form.categoryId || !form.title.trim()}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: '#1d4ed8', color: 'white' }}
            >
              {itemSaving ? 'Saving...' : '+ Add Content Item'}
            </button>
          </form>
        </div>

        {/* Category list with delete */}
        {cats.length > 0 && (
          <div
            className="rounded-xl p-4"
            style={{ background: '#111d2e', border: '1px solid #1a2840' }}
          >
            <div className="text-sm font-semibold mb-3" style={{ color: '#e2e8f0' }}>
              Existing Categories
            </div>
            <div className="space-y-1.5">
              {cats.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: '#0e1628' }}
                >
                  <span>{c.icon}</span>
                  <span className="flex-1 text-sm" style={{ color: '#e2e8f0' }}>
                    {c.title}
                  </span>
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                  <button
                    onClick={() => deleteCategory(c.id)}
                    className="text-base opacity-50 hover:opacity-100 transition-opacity ml-1"
                    title="Delete category"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: live preview ──────────────────────────────────────────── */}
      <div>
        <div
          className="rounded-xl p-4 sticky top-4"
          style={{ background: '#0e1628', border: '1px solid #1a2840' }}
        >
          <div className="text-sm font-semibold mb-3" style={{ color: '#e2e8f0' }}>
            Live Preview
          </div>

          {cats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPreviewCatId(c.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: previewCatId === c.id ? c.color + '1e' : '#1a2840',
                    color: previewCatId === c.id ? c.color : '#6b7fa3',
                    border: `1px solid ${previewCatId === c.id ? c.color + '66' : 'transparent'}`,
                  }}
                >
                  {c.icon} {c.title}
                </button>
              ))}
            </div>
          )}

          {previewCat ? (
            <ContentList category={previewCat} showDelete />
          ) : (
            <div className="text-sm text-center py-10" style={{ color: '#3d5070' }}>
              Add a category to see the preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
