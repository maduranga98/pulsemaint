import { Check, Minus } from 'lucide-react';
import { PLAN_LIMITS, ENTERPRISE_TIER_LIMITS } from '../../lib/planLimits';
import {
  ADDONS,
  COUNT_LIMIT_ROWS,
  ENTERPRISE_PLANS,
  ENTERPRISE_RATE_CARD,
  ENTERPRISE_RULES,
  LOCKED_FEATURE_ROWS,
  OPEN_ON_EVERY_PLAN,
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

/** Count limits of Starter, Growth, Factory and Enterprise (Enterprise is sized per customer). */
export function PlanLimitsTable() {
  return (
    <section>
      <Heading title="Plan limits" note="Counts apply to the whole company. Yearly billing = pay 10 months, get 12. File storage is not limited on any plan." />
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
                  {PLAN_PRICES[p].monthly === null ? `from $${(PLAN_PRICES[p].minMonthly ?? 0).toLocaleString('en-US')}` : `$${PLAN_PRICES[p].monthly}`}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[#1E3A5F]/60">
              <td className={`${TD} text-slate-400`}>Price / year</td>
              {PLAN_ORDER.map((p) => (
                <td key={p} className={`${TD} font-semibold`}>
                  {PLAN_PRICES[p].yearly === null ? 'Annual contract' : `$${PLAN_PRICES[p].yearly.toLocaleString('en-US')}`}
                </td>
              ))}
            </tr>
            {COUNT_LIMIT_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-[#1E3A5F]/60 last:border-0">
                <td className={`${TD} text-slate-400`}>{row.label}</td>
                {PLAN_ORDER.map((p) => (
                  <td key={p} className={TD}>
                    {p === 'enterprise' ? 'Custom' : formatLimit(PLAN_LIMITS[p][row.key], row.perMonth, row.months)}
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
  return (
    <section>
      <Heading title="Features by plan" note="Only the main and heavy-data features differ; everything else is open on every plan." />
      <div className={BOX}>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-[#1E3A5F]">
              <th className={TH}>Feature</th>
              {PLAN_ORDER.map((p) => <th key={p} className={TH}>{PLAN_DISPLAY_NAME[p]}</th>)}
            </tr>
          </thead>
          <tbody>
            {LOCKED_FEATURE_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-[#1E3A5F]/60">
                <td className={TD}>{row.label}</td>
                {PLAN_ORDER.map((p) => (
                  <td key={p} className={TD}>
                    {p === 'enterprise' ? 'Custom' : <Mark on={PLAN_LIMITS[p].features[row.key]} />}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className={TD}>Multi-plant management</td>
              {PLAN_ORDER.map((p) => {
                const plants = PLAN_LIMITS[p].plants;
                return (
                  <td key={p} className={TD}>
                    {p === 'enterprise' ? 'Custom' : plants === null || plants > 1 ? <Mark on label={plants === null ? undefined : `up to ${plants}`} /> : <Mark on={false} />}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        <span className="font-semibold text-slate-300">Open on every plan:</span> {OPEN_ON_EVERY_PLAN}
      </p>
    </section>
  );
}

function Mark({ on, label }: { on: boolean; label?: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="h-4 w-4" />{label && <span className="text-xs text-slate-300">{label}</span>}</span>
  ) : (
    <span className="inline-flex items-center text-slate-500"><Minus className="h-4 w-4" /><span className="sr-only">Not included</span></span>
  );
}

/** Enterprise limit presets, rate card and rules — platform console only. */
export function EnterprisePlansTable() {
  return (
    <section className="space-y-6">
      <div>
        <Heading
          title="Enterprise: limit presets"
          note={`Starting sizes to put a company on. Enterprise is quoted per customer from the rate card below — minimum $${(PLAN_PRICES.enterprise.minMonthly ?? 0).toLocaleString('en-US')} / month, annual contract — and includes every feature.`}
        />
        <div className={BOX}>
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-[#1E3A5F]">
                <th className={TH}> </th>
                {ENTERPRISE_PLANS.map((e) => <th key={e.id} className={TH}>{e.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {COUNT_LIMIT_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-[#1E3A5F]/60 last:border-0">
                  <td className={`${TD} text-slate-400`}>{row.label}</td>
                  {ENTERPRISE_PLANS.map((e) => (
                    <td key={e.id} className={TD}>{formatLimit(ENTERPRISE_TIER_LIMITS[e.id][row.key], row.perMonth, row.months)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className={`${TD} text-slate-400`}>All features</td>
                {ENTERPRISE_PLANS.map((e) => <td key={e.id} className={TD}><Mark on /></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <Heading title="Enterprise: how a quote is built" note="Every limit is a number in the contract. Add the lines you need." />
        <div className={BOX}>
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-[#1E3A5F]">
                <th className={TH}>Line</th>
                <th className={TH}>How we set the limit</th>
                <th className={TH}>Price</th>
                <th className={TH}>Volume price</th>
              </tr>
            </thead>
            <tbody>
              {ENTERPRISE_RATE_CARD.map((r) => (
                <tr key={r.line} className="border-b border-[#1E3A5F]/60 last:border-0">
                  <td className={`${TD} font-medium`}>{r.line}</td>
                  <td className={`${TD} text-slate-400`}>{r.limit}</td>
                  <td className={`${TD} font-semibold`}>{r.price}</td>
                  <td className={`${TD} text-slate-400`}>{r.volume ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-400 space-y-0.5">
          {ENTERPRISE_RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>
    </section>
  );
}

/** Add-on rate card — platform console only (applied as per-company limit overrides). */
export function AddOnsTable() {
  return (
    <section>
      <Heading title="Add-ons (any paid plan)" note="Sold by Lumora and applied to a company as limit overrides on its detail page." />
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
