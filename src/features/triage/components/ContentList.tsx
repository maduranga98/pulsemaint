import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { deleteContentItem, COL } from '../api';
import { useAuthStore } from '../../../store/authStore';
import type { TriageCategory, TriageContentItem } from '../types';

interface Props {
  category: TriageCategory;
  showDelete?: boolean;
}

const TYPE_ICON: Record<string, string> = {
  procedure: '🧭',
  guide: '📄',
  video: '▶️',
  pdf: '📑',
  image: '🖼️',
  media: '🎞️',
};

export function ContentList({ category, showDelete = false }: Props) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const [items, setItems] = useState<TriageContentItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<TriageContentItem | null>(null);

  useEffect(() => {
    if (!companyId || !category.id) return;
    setExpanded(null);
    setPlayingVideo(null);
    return onSnapshot(
      query(
        collection(db, COL.content),
        where('companyId', '==', companyId),
        where('categoryId', '==', category.id),
        orderBy('order', 'asc'),
      ),
      (snap) => {
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageContentItem)),
        );
      },
    );
  }, [companyId, category.id]);

  if (playingVideo) {
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setPlayingVideo(null)}
          className="flex items-center gap-2 mb-4 text-sm transition-colors hover:text-white"
          style={{ color: '#6b7fa3' }}
        >
          ← Back
        </button>
        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${playingVideo.videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={playingVideo.title}
          />
        </div>
        <div className="mt-4">
          <div className="font-semibold" style={{ color: '#e2e8f0' }}>
            {playingVideo.title}
          </div>
          <div className="text-sm mt-0.5" style={{ color: '#6b7fa3' }}>
            {playingVideo.meta}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">{category.icon}</span>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>
            {category.title}
          </h2>
          {category.desc && (
            <p className="text-sm mt-0.5" style={{ color: '#6b7fa3' }}>
              {category.desc}
            </p>
          )}
        </div>
      </div>

      {items.length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#111d2e', border: '1px solid #1a2840' }}
        >
          <div className="text-sm" style={{ color: '#3d5070' }}>
            No content in this category yet.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const isOpen = expanded === item.id;
          const isImageMedia =
            item.type === 'image' ||
            (item.type === 'media' && (item.fileType ?? '').startsWith('image/'));
          const isVideoMedia =
            item.type === 'media' && (item.fileType ?? '').startsWith('video/');
          // "media" files that are neither image nor video open/download externally.
          const isDownloadMedia =
            item.type === 'media' && !isImageMedia && !isVideoMedia;
          const isAction = item.type === 'video' || item.type === 'pdf' || isDownloadMedia;

          return (
            <div
              key={item.id}
              className="rounded-xl overflow-hidden"
              style={{ background: '#111d2e', border: '1px solid #1a2840' }}
            >
              <div className="flex items-center">
                <button
                  className="flex-1 flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = '#1a284033')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = 'transparent')
                  }
                  onClick={() => {
                    if (item.type === 'video') {
                      setPlayingVideo(item);
                      return;
                    }
                    if (item.type === 'pdf' || isDownloadMedia) {
                      if (item.fileUrl) window.open(item.fileUrl, '_blank');
                      return;
                    }
                    setExpanded(isOpen ? null : item.id);
                  }}
                >
                  <span className="text-xl shrink-0">{TYPE_ICON[item.type] ?? '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
                      {item.title}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6b7fa3' }}>
                      {item.meta}
                    </div>
                  </div>
                  {!isAction && (
                    <span
                      className="text-xs shrink-0 transition-transform duration-200"
                      style={{
                        color: '#3d5070',
                        display: 'inline-block',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                  )}
                </button>

                {showDelete && (
                  <button
                    onClick={() => deleteContentItem(item.id)}
                    className="px-3 py-3 text-lg transition-opacity opacity-50 hover:opacity-100"
                    title="Delete item"
                  >
                    🗑
                  </button>
                )}
              </div>

              {isOpen && (
                <div
                  className="px-4 pb-4"
                  style={{ borderTop: '1px solid #1a2840' }}
                >
                  {item.type === 'guide' && (
                    <ul className="mt-3 space-y-1.5">
                      {(item.body ?? []).map((line, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm"
                          style={{ color: '#e2e8f0' }}
                        >
                          <span className="mt-0.5 shrink-0" style={{ color: '#3b82f6' }}>
                            •
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}

                  {item.type === 'procedure' && (
                    <div className="mt-3 space-y-4">
                      {item.intro && (
                        <p className="text-sm italic" style={{ color: '#6b7fa3' }}>
                          {item.intro}
                        </p>
                      )}
                      {(item.steps ?? []).map((step, i) => (
                        <div key={i} className="flex gap-3">
                          <div
                            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                            style={{ background: '#1a2840', color: '#3b82f6' }}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 pt-0.5">
                            <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
                              {step.t}
                            </div>
                            <div className="text-sm mt-0.5" style={{ color: '#6b7fa3' }}>
                              {step.d}
                            </div>
                          </div>
                        </div>
                      ))}
                      {item.note && (
                        <div
                          className="flex items-start gap-2 p-3 rounded-lg text-sm"
                          style={{
                            background: '#f9731614',
                            border: '1px solid #f9731630',
                            color: '#fbbf24',
                          }}
                        >
                          <span className="shrink-0">⚠️</span>
                          <span>{item.note}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {isImageMedia && item.fileUrl && (
                    <div className="mt-3">
                      <img
                        src={item.fileUrl}
                        alt={item.title}
                        className="w-full rounded-lg"
                        style={{ border: '1px solid #1a2840' }}
                      />
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-2 text-xs"
                        style={{ color: '#3b82f6' }}
                      >
                        Open full size ↗
                      </a>
                    </div>
                  )}

                  {isVideoMedia && item.fileUrl && (
                    <div className="mt-3">
                      <video
                        src={item.fileUrl}
                        controls
                        className="w-full rounded-lg"
                        style={{ border: '1px solid #1a2840', background: '#000' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
