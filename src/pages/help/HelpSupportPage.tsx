import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Play, Search, X } from 'lucide-react';
import { getDashboardRoute } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LAUNCHER_PATH, usesLauncher } from '@/components/layout/navConfig';
import {
  HELP_MODULE_ROUTES,
  HELP_MODULE_VIDEOS,
  HELP_OTHER_VIDEOS,
  ROLE_HELP_MODULES,
  helpVideoEmbedUrl,
  helpVideoThumbnailUrl,
  type HelpModuleId,
  type HelpVideo,
} from './helpContent';

interface HelpGuide {
  title: string;
  steps: string[];
}

interface HelpModuleContent {
  title: string;
  description: string;
  guides: HelpGuide[];
}

export default function HelpSupportPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.userProfile?.role);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const isPhone = useMediaQuery('(max-width: 1023px)');

  const moduleIds = role ? ROLE_HELP_MODULES[role] : [];

  // The whole typed text is matched as one phrase (never word by word) and
  // only against topic titles: the main topic (module) title and its
  // sub-topic (guide) titles. A main-topic match shows that topic with all its
  // sub-topics; otherwise only the sub-topics whose title contains the phrase.
  const phrase = query.trim().toLowerCase();
  const searching = phrase.length > 0;

  const cards = useMemo(() => {
    const has = (text: string) => text.toLowerCase().includes(phrase);
    return moduleIds
      .map((id) => {
        const content = t(`help.modules.${id}`, { returnObjects: true }) as HelpModuleContent;
        return { id, content };
      })
      .filter(({ content }) => content && typeof content === 'object')
      .map(({ id, content }) => {
        const guides = content.guides ?? [];
        if (!searching || has(content.title)) return { id, content: { ...content, guides } };
        const hit = guides.filter((g) => has(g.title));
        return hit.length ? { id, content: { ...content, guides: hit } } : null;
      })
      .filter((c): c is { id: HelpModuleId; content: HelpModuleContent } => c !== null);
  }, [moduleIds, phrase, searching, t]);

  const withVideos = useMemo(() => cards.filter((c) => (HELP_MODULE_VIDEOS[c.id]?.length ?? 0) > 0), [cards]);
  const withoutVideos = useMemo(() => cards.filter((c) => !(HELP_MODULE_VIDEOS[c.id]?.length ?? 0)), [cards]);

  const otherVideos = useMemo(
    () => (searching ? HELP_OTHER_VIDEOS.filter((v) => v.title.toLowerCase().includes(phrase)) : HELP_OTHER_VIDEOS),
    [phrase, searching],
  );

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('help.pageTitle')}</h1>
        <p className="mt-1 text-slate-600">{t('help.pageSubtitle')}</p>
      </div>

      {/* Guided tour: a floating card that walks through the menu, one stop at a time. */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1A56DB]/20 text-[#60A5FA]"><Compass className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{t('help.tour.bannerTitle')}</p>
          <p className="mt-0.5 text-sm text-white/80">{t('help.tour.bannerBody')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            // The tour is told from the dashboard — the same page and layout as the
            // first-time tour — so it shows every stop (the plant switcher, for one,
            // is hidden on this Help page and would be skipped here). On phones the
            // equivalent screen is the app launcher, which is where its features live.
            if (role) navigate(isPhone && usesLauncher(role) ? LAUNCHER_PATH : getDashboardRoute(role), { state: { startTour: 'main' } });
          }}
          className="shrink-0 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1648B8]"
        >
          {t('help.tour.bannerButton')}
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder={t('help.searchPlaceholder') ?? undefined}
            aria-label={t('help.searchPlaceholder') ?? 'Search'}
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 bg-transparent py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {cards.length === 0 && otherVideos.length === 0 ? (
        <p className="text-slate-500 text-sm">{t('help.noResults')}</p>
      ) : (
        <div className="space-y-4">
          {withVideos.map(({ id, content }) => (
            <HelpModuleCard key={id} id={id} content={content} searching={searching} />
          ))}

          {withoutVideos.map(({ id, content }) => (
            <HelpModuleCard key={id} id={id} content={content} searching={searching} />
          ))}

          {/* "Other videos" (getting started and overviews) come last, after every
              topic, one video after another. */}
          {otherVideos.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">{t('help.videos.otherTitle', { defaultValue: 'Other videos' })}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {t('help.videos.otherBody', { defaultValue: 'Getting started and overview videos.' })}
              </p>
              <div className="mt-4 space-y-6">
                {otherVideos.map((v) => (
                  <div key={v.youtubeId}>
                    <h4 className="mb-2 text-sm font-semibold text-slate-900">{v.title}</h4>
                    <div className="max-w-2xl">
                      <HelpVideoPlayer video={v} hideCaption />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t('help.contact.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('help.contact.body')}</p>
        <a
          href="mailto:support@firmicore.com"
          className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {t('help.contact.cta')}
        </a>
      </div>
    </div>
  );
}

function HelpModuleCard({ id, content, searching }: { id: HelpModuleId; content: HelpModuleContent; searching: boolean }) {
  const { t } = useTranslation();
  const route = HELP_MODULE_ROUTES[id];
  const videos = HELP_MODULE_VIDEOS[id] ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{content.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{content.description}</p>
        </div>
        <Link
          to={route}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('help.openLink', { module: content.title })}
        </Link>
      </div>

      {content.guides.length > 0 && (
        <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {content.guides.map((guide, i) => (
            <details key={`${i}-${searching}`} className="group py-2" open={searching || i === 0}>
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-800 marker:content-none flex items-center justify-between gap-2">
                {guide.title}
                <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-180">▾</span>
              </summary>
              <ol className="mt-2 space-y-1.5 list-decimal list-outside pl-5">
                {guide.steps.map((step, j) => (
                  <li key={j} className="text-sm text-slate-600">
                    {step}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-semibold text-slate-900">{t('help.videos.title', { defaultValue: 'Video guide' })}</h4>
          <VideoGrid videos={videos} />
        </div>
      )}
    </div>
  );
}

function VideoGrid({ videos }: { videos: HelpVideo[] }) {
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {videos.map((v) => (
        <HelpVideoPlayer key={v.youtubeId} video={v} />
      ))}
    </div>
  );
}

// Shows a thumbnail first and only loads the player once it is clicked, so a
// page with many videos stays light. The video plays here, not on YouTube.
function HelpVideoPlayer({ video, hideCaption = false }: { video: HelpVideo; hideCaption?: boolean }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  return (
    <figure>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
        {playing ? (
          <iframe
            src={helpVideoEmbedUrl(video.youtubeId)}
            title={video.title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={t('help.videos.play', { defaultValue: 'Play video: {{title}}', title: video.title })}
            className="group absolute inset-0 h-full w-full"
          >
            <img
              src={helpVideoThumbnailUrl(video.youtubeId)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1A56DB] text-white shadow-lg group-hover:bg-[#1648B8]">
                <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      {!hideCaption && <figcaption className="mt-2 text-sm font-medium text-slate-800">{video.title}</figcaption>}
    </figure>
  );
}
