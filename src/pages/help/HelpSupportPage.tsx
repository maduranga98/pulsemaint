import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { HELP_MODULE_ROUTES, ROLE_HELP_MODULES, type HelpModuleId } from './helpContent';

interface HelpFaq {
  q: string;
  a: string;
}

interface HelpModuleContent {
  title: string;
  description: string;
  faqs: HelpFaq[];
}

export default function HelpSupportPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.userProfile?.role);
  const [query, setQuery] = useState('');

  const moduleIds = role ? ROLE_HELP_MODULES[role] : [];

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return moduleIds
      .map((id) => {
        const content = t(`help.modules.${id}`, { returnObjects: true }) as HelpModuleContent;
        return { id, content };
      })
      .filter(({ content }) => {
        if (!q) return true;
        const haystack = [
          content.title,
          content.description,
          ...content.faqs.flatMap((f) => [f.q, f.a]),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [moduleIds, query, t]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('help.pageTitle')}</h1>
        <p className="mt-1 text-slate-600">{t('help.pageSubtitle')}</p>
      </div>

      <div className="mb-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('help.searchPlaceholder') ?? undefined}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {cards.length === 0 ? (
        <p className="text-slate-500 text-sm">{t('help.noResults')}</p>
      ) : (
        <div className="space-y-4">
          {cards.map(({ id, content }) => (
            <HelpModuleCard key={id} id={id} content={content} />
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

function HelpModuleCard({ id, content }: { id: HelpModuleId; content: HelpModuleContent }) {
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

      {content.faqs.length > 0 && (
        <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {content.faqs.map((faq, i) => (
            <details key={i} className="group py-2">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-800 marker:content-none flex items-center justify-between gap-2">
                {faq.q}
                <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-2 text-sm text-slate-600">{faq.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
