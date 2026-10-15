import { useAuthStore } from '@/store/authStore';
import { formatMoneyCompactIn, formatMoneyIn } from '@/lib/money';

/**
 * One currency for every money figure in the app: the one chosen at company
 * registration (Settings → Company → Currency). Amounts are plain numbers
 * entered in that currency, so display code only needs its label — never a
 * hardcoded "LKR"/"USD".
 */
export type CompanyCurrency = 'LKR' | 'USD' | 'AED' | 'SAR';

export const DEFAULT_CURRENCY: CompanyCurrency = 'LKR';

/** The signed-in company's currency code (works outside React too). */
export function getCompanyCurrency(): string {
  return useAuthStore.getState().company?.currency || DEFAULT_CURRENCY;
}

export function formatMoney(amount: number | null | undefined, opts: { decimals?: number; currency?: string } = {}): string {
  return formatMoneyIn(opts.currency ?? getCompanyCurrency(), amount, opts.decimals ?? 0);
}

export function formatMoneyCompact(amount: number | null | undefined, currency: string = getCompanyCurrency()): string {
  return formatMoneyCompactIn(currency, amount);
}

type I18nLike = { options: { interpolation?: object } };

/**
 * Makes every translated label that says "({{currency}})" follow the company
 * currency (i18next reads defaultVariables on each t() call).
 */
function syncCurrencyToI18n(i18n: I18nLike, currency: string): void {
  const interpolation = (i18n.options.interpolation ?? (i18n.options.interpolation = {})) as { defaultVariables?: Record<string, unknown> };
  interpolation.defaultVariables = { ...(interpolation.defaultVariables ?? {}), currency };
}

/** Keep i18n's {{currency}} in step with the loaded company. Call once at startup with the i18n instance. */
export function startCurrencySync(i18n: I18nLike): void {
  syncCurrencyToI18n(i18n, getCompanyCurrency());
  useAuthStore.subscribe((s, prev) => {
    if (s.company?.currency !== prev.company?.currency) syncCurrencyToI18n(i18n, s.company?.currency || DEFAULT_CURRENCY);
  });
}
