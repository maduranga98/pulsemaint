import { useTranslation } from 'react-i18next';
import { HelpCircle, Mail, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface FaqItem {
  question: string;
  answer: string;
}

function readFaqItems(t: (key: string, options?: Record<string, unknown>) => unknown, key: string): FaqItem[] {
  const raw = t(key, { returnObjects: true, defaultValue: [] });
  return Array.isArray(raw) ? (raw as FaqItem[]) : [];
}

function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="divide-y divide-slate-100">
        {items.map((item, index) => (
          <details key={index} className="group py-3 first:pt-0 last:pb-0">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-medium text-slate-800">
              <span>{item.question}</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function HelpSupportPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.userProfile?.role);

  const roleTitle = role ? (t(`common.help.roles.${role}.title`, '') as string) : '';
  const roleItems = role ? readFaqItems(t, `common.help.roles.${role}.items`) : [];
  const generalItems = readFaqItems(t, 'common.help.general.items');

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900">{t('common.help.title', 'Help & Support')}</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {t('common.help.subtitle', 'Answers for your role, plus how to reach us for anything else.')}
        </p>
      </div>

      <div className="px-6 py-5 space-y-6 max-w-3xl">
        {roleItems.length > 0 && (
          <FaqSection title={roleTitle || t('common.help.general.title', 'General')} items={roleItems} />
        )}

        <FaqSection title={t('common.help.general.title', 'General') as string} items={generalItems} />

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900">{t('common.help.contact.title', 'Contact support')}</h2>
          </div>
          <p className="text-sm text-slate-600">
            {t(
              'common.help.contact.body',
              "Can't find what you need? Contact your company administrator, or email support@firmicore.app and we'll get back to you."
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
