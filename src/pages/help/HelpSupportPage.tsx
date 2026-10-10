import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { HELP_MODULE_ROUTES, ROLE_HELP_MODULES, type HelpModuleId } from './helpContent';

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

  const moduleIds = role ? ROLE_HELP_MODULES[role] : [];

  const tokens = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );
  const searching = tokens.length > 0;

  // Every typed word must appear somewhere (any order, partial words ok), so
  // "add machine" finds "Add a machine". A card whose own title/description
  // matches shows all its guides; otherwise only the guides that match, so the
  // list actually narrows down instead of keeping every module on screen.
  const cards = useMemo(() => {
    const matches = (text: string) => {
      const lower = text.toLowerCase();
      return tokens.every((tok) => lower.includes(tok));
    };
    return moduleIds
      .map((id) => {
        const content = t(`help.modules.${id}`, { returnObjects: true }) as HelpModuleContent;
        return { id, content };
      })
      .filter(({ content }) => content && typeof content === 'object')
      .map(({ id, content }) => {
        const guides = content.guides ?? [];
        if (!searching) return { id, content: { ...content, guides } };
        if (matches(`${content.title} ${content.description}`)) return { id, content: { ...content, guides } };
        const hit = guides.filter((g) => matches(`${g.title} ${(g.steps ?? []).join(' ')}`));
        return hit.length ? { id, content: { ...content, guides: hit } } : null;
      })
      .filter((c): c is { id: HelpModuleId; content: HelpModuleContent } => c !== null);
  }, [moduleIds, tokens, searching, t]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('help.pageTitle')}</h1>
        <p className="mt-1 text-slate-600">{t('help.pageSubtitle')}</p>
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

      {cards.length === 0 ? (
        <p className="text-slate-500 text-sm">{t('help.noResults')}</p>
      ) : (
        <div className="space-y-4">
          {cards.map(({ id, content }) => (
            <HelpModuleCard key={id} id={id} content={content} searching={searching} />
          ))}
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
    </div>
  );
}
