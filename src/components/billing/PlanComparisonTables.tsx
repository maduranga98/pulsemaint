import { useTranslation } from 'react-i18next';
import { Check, Minus } from 'lucide-react';
import { PLAN_LIMITS, ENTERPRISE_TIER_LIMITS } from '../../lib/planLimits';
import {
  ADDONS,
  COUNT_LIMIT_ROWS,
  ENTERPRISE_PLANS,
  LOCKED_FEATURE_ROWS,
  PLAN_DISPLAY_NAME,
  PLAN_ORDER,
  PLAN_PRICES,
  formatLimit,
} from '../../lib/planCatalog';

const TH = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const TD = 'px-3 py-2 text-sm text-slate-200';
const BOX = 'overflow-x-auto rounded-xl border border-[#1E3A5F] bg-[#0F1E35]';

function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-base font-semibold text-white!">{title}</h2>
      {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
    </div>
  );
}

/** Count limits of Starter, Workshop, Factory and Enterprise (Enterprise is sized per customer). */
export function PlanLimitsTable() {
  return (
    <section>
      <Heading title="Plan limits" note="Counts apply to the whole company. File storage is not limited on any plan." />
      <div className={BOX}>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-[#1E3A5F]">
              <th className={TH}> </th>
              {PLAN_ORDER.map((p) => <th key={p} className={TH}>{PLAN_DISPLAY_NAME[p]}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#1E3A5F]/60">
              <td className={`${TD} text-slate-400`}>Price / month</td>
              {PLAN_ORDER.map((p) => (
                <td key={p} className={`${TD} font-semibold`}>
                  {PLAN_PRICES[p].monthly === null ? 'Custom' : `$${PLAN_PRICES[p].monthly}`}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[#1E3A5F]/60">
              <td className={`${TD} text-slate-400`}>Price / year</td>
              {PLAN_ORDER.map((p) => (
                <td key={p} className={`${TD} font-semibold`}>
                  {PLAN_PRICES[p].yearly === null ? 'Custom' : `$${PLAN_PRICES[p].yearly.toLocaleString('en-US')}`}
                </td>
              ))}
            </tr>
            {COUNT_LIMIT_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-[#1E3A5F]/60 last:border-0">
                <td className={`${TD} text-slate-400`}>{row.label}</td>
                {PLAN_ORDER.map((p) => (
                  <td key={p} className={TD}>
                    {p === 'enterprise' ? 'Custom' : formatLimit(PLAN_LIMITS[p][row.key], row.perMonth)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Which main/heavy features each plan unlocks. Enterprise is agreed per customer. */
export function LockedFeaturesTable() {
  const { t } = useTranslation();
  const custom = t('common.billing.customPrice');
  return (
    <section>
      <Heading
        title={t('common.billing.unlock.title', 'Unlock features')}
        note={t('common.billing.unlock.note', 'Only the main and heavy-data features are locked; everything else is open on every plan.')}
      />
      <div className={BOX}>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-[#1E3A5F]">
              <th className={TH}>{t('common.billing.unlock.feature', 'Feature')}</th>
              {PLAN_ORDER.map((p) => <th key={p} className={TH}>{PLAN_DISPLAY_NAME[p]}</th>)}
            </tr>
          </thead>
          <tbody>
            {LOCKED_FEATURE_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-[#1E3A5F]/60">
                <td className={TD}>{t(`common.billing.unlock.rows.${row.key}`, row.label)}</td>
                {PLAN_ORDER.map((p) => (
                  <td key={p} className={TD}>
                    {p === 'enterprise' ? custom : <Mark on={PLAN_LIMITS[p].features[row.key]} />}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className={TD}>{t('common.billing.unlock.morePlants', 'More than 1 plant')}</td>
              {PLAN_ORDER.map((p) => {
                const plants = PLAN_LIMITS[p].plants;
                return (
                  <td key={p} className={TD}>
                    {p === 'enterprise'
                      ? custom
                      : plants === null || plants > 1
                      ? <Mark on label={plants === null ? undefined : t('common.billing.unlock.upTo', { count: plants, defaultValue: 'up to {{count}}' })} />
                      : <Mark on={false} />}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Mark({ on, label }: { on: boolean; label?: string }) {
  const { t } = useTranslation();
  return on ? (
    <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="h-4 w-4" />{label && <span className="text-xs text-slate-300">{label}</span>}</span>
  ) : (
    <span className="inline-flex items-center text-slate-500"><Minus className="h-4 w-4" /><span className="sr-only">{t('common.billing.unlock.notIncluded', 'Not included')}</span></span>
  );
}

/** Sized Enterprise plans with list prices — platform console only. */
export function EnterprisePlansTable() {
  return (
    <section>
      <Heading title="Enterprise plans" note="List prices to quote from — every Enterprise plan is priced individually per customer and includes every feature." />
      <div className={BOX}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-[#1E3A5F]">
              <th className={TH}> </th>
              {ENTERPRISE_PLANS.map((e) => <th key={e.id} className={TH}>{e.name}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#1E3A5F]/60">
              <td className={`${TD} text-slate-400`}>Price / month</td>
              {ENTERPRISE_PLANS.map((e) => (
                <td key={e.id} className={`${TD} font-semibold`}>{e.from ? 'From ' : ''}${e.monthly.toLocaleString('en-US')}{e.from ? ' (quote)' : ''}</td>
              ))}
            </tr>
            <tr className="border-b border-[#1E3A5F]/60">
              <td className={`${TD} text-slate-400`}>Price / year</td>
              {ENTERPRISE_PLANS.map((e) => (
                <td key={e.id} className={`${TD} font-semibold`}>{e.from ? 'From ' : ''}${e.yearly.toLocaleString('en-US')}{e.from ? ' (quote)' : ''}</td>
              ))}
            </tr>
            {COUNT_LIMIT_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-[#1E3A5F]/60 last:border-0">
                <td className={`${TD} text-slate-400`}>{row.label}</td>
                {ENTERPRISE_PLANS.map((e) => (
                  <td key={e.id} className={TD}>{formatLimit(ENTERPRISE_TIER_LIMITS[e.id][row.key], row.perMonth)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td className={`${TD} text-slate-400`}>All locked features</td>
              {ENTERPRISE_PLANS.map((e) => <td key={e.id} className={TD}><Mark on /></td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Add-on rate card — platform console only (applied as per-company limit overrides). */
export function AddOnsTable() {
  return (
    <section>
      <Heading title="Add-ons" note="Sold by Lumora and applied to a company as limit overrides on its detail page." />
      <div className={BOX}>
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-[#1E3A5F]">
              <th className={TH}>Add-on</th>
              <th className={TH}>Price</th>
              <th className={TH}>Note</th>
            </tr>
          </thead>
          <tbody>
            {ADDONS.map((a) => (
              <tr key={a.label} className="border-b border-[#1E3A5F]/60 last:border-0">
                <td className={TD}>{a.label}</td>
                <td className={`${TD} font-semibold`}>{a.price}</td>
                <td className={`${TD} text-slate-400`}>{a.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
