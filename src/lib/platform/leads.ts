import { countryLabel } from '@/lib/countries';

/**
 * Sales leads for FirmiCore itself — prospects brought in by outside
 * marketing (Facebook/Google ads, referrals, events, the website form)
 * that Lumora Ventures calls, demos and closes. Pure helpers only; Firestore
 * access lives in src/services/platformLeadsService.ts.
 *
 * Collections (superadmin only, see firestore.rules):
 *   platformLeads/{id}            one prospect
 *   platformLeadActivities/{id}   append-only call/note/status/demo log, `leadId` back-reference
 */

export const LEAD_STATUSES = [
  'new', 'called', 'not_answered', 'follow_up', 'demo_booked', 'demo_done', 'negotiation', 'closed_won', 'closed_lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  called: 'Called',
  not_answered: 'Not answered',
  follow_up: 'Follow-up',
  demo_booked: 'Demo booked',
  demo_done: 'Demo done',
  negotiation: 'Negotiation',
  closed_won: 'Closed won',
  closed_lost: 'Closed lost',
};

export const LEAD_TAGS = ['Feature', 'Bug', 'Complaint', 'Hot', 'Price', 'Other'] as const;
export const LEAD_SOURCES = ['Facebook ad', 'Google ad', 'Website', 'Referral', 'WhatsApp', 'Event', 'Cold call', 'Partner', 'Other'] as const;
export const LEAD_CURRENCIES = ['LKR', 'USD'] as const;
export type LeadCurrency = (typeof LEAD_CURRENCIES)[number];

export const CALL_OUTCOMES = ['spoke', 'no_answer', 'busy', 'call_back', 'wrong_number'] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  spoke: 'Spoke to them',
  no_answer: 'No answer',
  busy: 'Busy / cut the call',
  call_back: 'Asked to call back',
  wrong_number: 'Wrong number',
};

export type LeadActivityType = 'call' | 'note' | 'status' | 'demo';

export interface Lead {
  id: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  location: string;
  district: string;
  /** Where the lead came from (an outside campaign, referral…). */
  source: string;
  /** Campaign / ad set name, free text — lets marketing see which ad produced it. */
  campaign: string;
  industry: string;
  /** Day the lead arrived, ms (local midnight). */
  leadDate: number | null;
  status: LeadStatus;
  callsMade: number;
  nextCallAt: number | null;
  followUpNote: string;
  demoAt: number | null;
  demoRequested: boolean;
  priceQuoted: string;
  closedAmount: number;
  currency: LeadCurrency;
  closedAt: number | null;
  mainProblem: string;
  tags: string[];
  notes: string;
  /** platformSalesTeam member working the lead (calls, demo). */
  assignedTo: string | null;
  /** platformSalesTeam member (outside marketer / agent) who brought the lead in — earns the commission. */
  marketerId: string | null;
  /** FirmiCore company this lead became, once it signed up. */
  companyId: string | null;
  archived: boolean;
  createdAt: number | null;
  updatedAt: number | null;
  lastActivityAt: number | null;
  createdByEmail: string | null;
}

export type LeadInput = Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt' | 'createdByEmail' | 'archived' | 'closedAt'>;

export interface LeadActivity {
  id: string;
  leadId: string;
  /** Denormalised so the day report reads without joining leads. */
  leadName: string;
  type: LeadActivityType;
  outcome: CallOutcome | null;
  /** Call #n for this lead, for type 'call'. */
  callNumber: number | null;
  body: string;
  statusFrom: LeadStatus | null;
  statusTo: LeadStatus | null;
  nextCallAt: number | null;
  /** When it happened, ms (client clock — what the day report filters on). */
  at: number;
  authorEmail: string | null;
}

export function emptyLead(now = Date.now()): LeadInput {
  return {
    businessName: '', contactPerson: '', phone: '', email: '', location: '', district: '', source: '', campaign: '', industry: '',
    leadDate: startOfDay(now), status: 'new', callsMade: 0, nextCallAt: null, followUpNote: '', demoAt: null, demoRequested: false,
    priceQuoted: '', closedAmount: 0, currency: 'LKR', mainProblem: '', tags: [], notes: '', assignedTo: null, marketerId: null, companyId: null,
  };
}

export function isOpen(lead: Pick<Lead, 'status' | 'archived'>): boolean {
  return !lead.archived && lead.status !== 'closed_won' && lead.status !== 'closed_lost';
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number): number {
  return startOfDay(ms) + 86_400_000 - 1;
}

/**
 * Where a lead moves after a logged call, so the board keeps itself up to
 * date. Only early-pipeline stages move — a call never drags a lead back
 * from demo/negotiation/closed.
 */
export function statusAfterCall(current: LeadStatus, outcome: CallOutcome, hasNextCall: boolean): LeadStatus {
  const early: LeadStatus[] = ['new', 'called', 'not_answered', 'follow_up'];
  if (!early.includes(current)) return current;
  if (outcome === 'wrong_number') return 'closed_lost';
  if (outcome === 'no_answer' || outcome === 'busy') return hasNextCall ? 'follow_up' : 'not_answered';
  if (hasNextCall || outcome === 'call_back') return 'follow_up';
  return 'called';
}

/** Fields that must change alongside a status change (close date / demo). */
export function statusSideEffects(from: LeadStatus, to: LeadStatus, now = Date.now()): Partial<Pick<Lead, 'closedAt'>> {
  if (to === from) return {};
  if (to === 'closed_won' || to === 'closed_lost') return { closedAt: now };
  if (from === 'closed_won' || from === 'closed_lost') return { closedAt: null };
  return {};
}

export interface LeadStats {
  open: number;
  demos: number;
  demosToday: number;
  followUpsDue: number;
  won: number;
  revenue: Record<string, number>;
}

export function leadStats(leads: Lead[], now = Date.now()): LeadStats {
  const end = endOfDay(now);
  const start = startOfDay(now);
  const s: LeadStats = { open: 0, demos: 0, demosToday: 0, followUpsDue: 0, won: 0, revenue: {} };
  for (const l of leads) {
    if (l.archived) continue;
    if (isOpen(l)) s.open++;
    if (l.status === 'demo_booked' || l.status === 'demo_done') s.demos++;
    if (l.demoAt && l.demoAt >= start && l.demoAt <= end) s.demosToday++;
    if (isOpen(l) && l.nextCallAt && l.nextCallAt <= end) s.followUpsDue++;
    if (l.status === 'closed_won') {
      s.won++;
      s.revenue[l.currency] = (s.revenue[l.currency] ?? 0) + (l.closedAmount || 0);
    }
  }
  return s;
}

export function fmtAmount(amount: number, currency: string): string {
  return `${currency === 'LKR' ? 'Rs' : currency} ${Math.round(amount).toLocaleString('en-US')}`;
}

export function revenueText(revenue: Record<string, number>): string {
  const parts = Object.entries(revenue).filter(([, v]) => v > 0).map(([c, v]) => fmtAmount(v, c));
  return parts.length ? parts.join(' · ') : '0';
}

export interface CallBuckets { overdue: Lead[]; today: Lead[]; upcoming: Lead[] }

/** Open leads with a booked next call, soonest first. "Overdue" = before now. */
export function scheduledCalls(leads: Lead[], now = Date.now()): CallBuckets {
  const end = endOfDay(now);
  const rows = leads.filter((l) => isOpen(l) && l.nextCallAt).sort((a, b) => a.nextCallAt! - b.nextCallAt!);
  return {
    overdue: rows.filter((l) => l.nextCallAt! < now),
    today: rows.filter((l) => l.nextCallAt! >= now && l.nextCallAt! <= end),
    upcoming: rows.filter((l) => l.nextCallAt! > end),
  };
}

export function matchesSearch(lead: Lead, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, '');
  return [lead.businessName, lead.contactPerson, lead.location, lead.district, lead.email, lead.source, lead.campaign]
    .some((v) => v?.toLowerCase().includes(needle))
    || (digits.length >= 3 && lead.phone.replace(/\D/g, '').includes(digits));
}

/** Sri Lankan numbers → wa.me digits (07x… → 947x…). Other numbers are kept as typed. */
export function whatsappNumber(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (/^0\d{9}$/.test(d)) return `94${d.slice(1)}`;
  return d;
}

export interface DayReport {
  calls: number;
  notes: number;
  customers: number;
  demosBooked: number;
  newLeads: number;
  won: number;
  wonAmount: Record<string, number>;
  outcomes: Record<string, number>;
  rows: LeadActivity[];
}

/** Activity for one day (activities already filtered to that day by the caller or here). */
export function dayReport(day: number, activities: LeadActivity[], leads: Lead[]): DayReport {
  const start = startOfDay(day);
  const end = endOfDay(day);
  const rows = activities.filter((a) => a.at >= start && a.at <= end).sort((a, b) => a.at - b.at);
  const outcomes: Record<string, number> = {};
  for (const a of rows) {
    const key = a.type === 'call' && a.outcome ? CALL_OUTCOME_LABEL[a.outcome] : a.type === 'note' ? 'Note' : null;
    if (key) outcomes[key] = (outcomes[key] ?? 0) + 1;
  }
  const wonLeads = leads.filter((l) => l.status === 'closed_won' && l.closedAt && l.closedAt >= start && l.closedAt <= end);
  const wonAmount: Record<string, number> = {};
  for (const l of wonLeads) wonAmount[l.currency] = (wonAmount[l.currency] ?? 0) + (l.closedAmount || 0);
  return {
    calls: rows.filter((a) => a.type === 'call').length,
    notes: rows.filter((a) => a.type === 'note').length,
    customers: new Set(rows.map((a) => a.leadId)).size,
    demosBooked: rows.filter((a) => a.type === 'demo').length,
    newLeads: leads.filter((l) => {
      const t = l.createdAt ?? l.leadDate;
      return !!t && t >= start && t <= end;
    }).length,
    won: wonLeads.length,
    wonAmount,
    outcomes,
    rows,
  };
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function isoDate(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoDateTime(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${isoDate(ms)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const LEAD_EXPORT_HEADER = [
  'Business name', 'Contact person', 'Phone', 'Email', 'Location', 'Country', 'Source', 'Campaign', 'Industry', 'Lead date', 'Status',
  'Calls made', 'Next call', 'Follow-up note', 'Demo', 'Price told', 'Closed amount', 'Currency', 'Main problem', 'Tags', 'Notes',
  'Assigned to', 'Brought in by',
];

export function leadsToCsv(leads: Lead[], memberName: (id: string | null) => string = () => ''): string {
  return toCsv(LEAD_EXPORT_HEADER, leads.map((l) => [
    l.businessName, l.contactPerson, l.phone, l.email, l.location, countryLabel(l.district), l.source, l.campaign, l.industry, isoDate(l.leadDate),
    LEAD_STATUS_LABEL[l.status], l.callsMade, isoDateTime(l.nextCallAt), l.followUpNote, isoDateTime(l.demoAt), l.priceQuoted,
    l.closedAmount || '', l.currency, l.mainProblem, l.tags.join('; '), l.notes, memberName(l.assignedTo), memberName(l.marketerId),
  ]));
}

export function dayReportToCsv(report: DayReport, leads: Lead[]): string {
  const byId = new Map(leads.map((l) => [l.id, l]));
  return toCsv(['Time', 'Customer', 'Phone', 'Type', 'Outcome', 'Note', 'Status now', 'By'], report.rows.map((a) => {
    const lead = byId.get(a.leadId);
    return [
      isoDateTime(a.at), lead?.businessName ?? a.leadName, lead?.phone ?? '', activityTypeLabel(a), activityOutcomeLabel(a), a.body,
      lead ? LEAD_STATUS_LABEL[lead.status] : '', a.authorEmail ?? '',
    ];
  }));
}

export function activityTypeLabel(a: Pick<LeadActivity, 'type' | 'callNumber'>): string {
  switch (a.type) {
    case 'call': return a.callNumber ? `Call #${a.callNumber}` : 'Call';
    case 'note': return 'Note';
    case 'demo': return 'Demo';
    default: return 'Status';
  }
}

export function activityOutcomeLabel(a: Pick<LeadActivity, 'type' | 'outcome' | 'statusFrom' | 'statusTo'>): string {
  if (a.type === 'call' && a.outcome) return CALL_OUTCOME_LABEL[a.outcome];
  if (a.type === 'status' && a.statusTo) return `${a.statusFrom ? LEAD_STATUS_LABEL[a.statusFrom] : '—'} → ${LEAD_STATUS_LABEL[a.statusTo]}`;
  if (a.type === 'demo') return a.statusTo === 'demo_done' ? 'Demo done' : 'Demo booked';
  return 'Note';
}

// ---------------------------------------------------------------------------
// Import (CSV / Excel exported from Facebook Lead Ads, Google Sheets, etc.)
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<keyof Pick<LeadInput,
  'businessName' | 'contactPerson' | 'phone' | 'email' | 'location' | 'district' | 'source' | 'campaign' | 'industry' | 'leadDate' | 'notes' | 'mainProblem' | 'status'>, string[]> = {
  businessName: ['business name', 'business', 'company', 'company name', 'garage', 'organisation', 'organization', 'factory', 'name of business'],
  contactPerson: ['contact person', 'contact', 'full name', 'name', 'owner', 'contact name', 'first name'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'telephone', 'tel', 'whatsapp'],
  email: ['email', 'e-mail', 'email address'],
  location: ['location', 'city', 'town', 'address', 'area'],
  district: ['country', 'district', 'province', 'region', 'state'],
  source: ['source', 'lead source', 'platform', 'channel'],
  campaign: ['campaign', 'campaign name', 'ad name', 'ad set name', 'adset name', 'form name'],
  industry: ['industry', 'business type', 'sector', 'type'],
  leadDate: ['lead date', 'date', 'created', 'created time', 'created_time', 'submitted', 'timestamp'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'message'],
  mainProblem: ['main problem', 'problem', 'pain point', 'need', 'requirement'],
  status: ['status', 'stage', 'lead status'],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').replace(/[^a-z0-9 -]/g, '').trim();

/** Header → lead field, by alias; unknown headers are ignored. */
export function mapImportHeaders(headers: string[]): Record<number, keyof typeof HEADER_ALIASES> {
  const out: Record<number, keyof typeof HEADER_ALIASES> = {};
  const used = new Set<string>();
  // Exact alias matches first so "name" doesn't steal "business name".
  for (const pass of ['exact', 'loose'] as const) {
    headers.forEach((h, i) => {
      if (out[i]) return;
      const n = norm(h);
      for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
        if (used.has(field)) continue;
        const hit = pass === 'exact' ? aliases.includes(n) : aliases.some((a) => a.length > 3 && n.includes(a));
        if (hit) {
          out[i] = field;
          used.add(field);
          return;
        }
      }
    });
  }
  return out;
}

function parseImportDate(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : startOfDay(v.getTime());
  if (typeof v === 'number') {
    // Excel serial date
    if (v > 20000 && v < 80000) return startOfDay(Math.round((v - 25569) * 86_400_000) + new Date().getTimezoneOffset() * 60_000);
    return null;
  }
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : startOfDay(t);
}

function parseStatus(v: string): LeadStatus {
  const n = norm(v).replace(/ /g, '_');
  if ((LEAD_STATUSES as readonly string[]).includes(n)) return n as LeadStatus;
  const byLabel = LEAD_STATUSES.find((s) => norm(LEAD_STATUS_LABEL[s]) === norm(v));
  return byLabel ?? 'new';
}

export interface ImportResult { leads: LeadInput[]; skipped: number }

/** Rows as arrays (first row = headers). Rows without a business or contact name and phone/email are skipped. */
export function parseImportRows(table: unknown[][], defaults: { source?: string; now?: number } = {}): ImportResult {
  const [headerRow, ...body] = table;
  if (!headerRow) return { leads: [], skipped: 0 };
  const map = mapImportHeaders(headerRow.map((h) => String(h ?? '')));
  const leads: LeadInput[] = [];
  let skipped = 0;
  for (const row of body) {
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;
    const lead = emptyLead(defaults.now);
    for (const [idx, field] of Object.entries(map)) {
      const raw = row[Number(idx)];
      if (raw == null || raw === '') continue;
      if (field === 'leadDate') lead.leadDate = parseImportDate(raw) ?? lead.leadDate;
      else if (field === 'status') lead.status = parseStatus(String(raw));
      else lead[field] = String(raw).trim().replace(/^p:\+?/, (m) => (field === 'phone' ? (m.includes('+') ? '+' : '') : m));
    }
    if (!lead.businessName) lead.businessName = lead.contactPerson;
    if (!lead.businessName || (!lead.phone && !lead.email)) {
      skipped++;
      continue;
    }
    if (!lead.source && defaults.source) lead.source = defaults.source;
    leads.push(lead);
  }
  return { leads, skipped };
}

/** Phone digits for duplicate detection (last 9 digits, so 077… and +9477… match). */
export function phoneKey(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : d;
}

// ---------------------------------------------------------------------------
// Sales team (outside marketers, agents, callers — no FirmiCore logins) and
// pipeline insights.
// ---------------------------------------------------------------------------

export const TEAM_ROLES = ['marketer', 'agent', 'caller', 'manager'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  marketer: 'Outside marketer', agent: 'Referral agent', caller: 'Caller / sales', manager: 'Sales manager',
};

export interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: TeamRole;
  /** % of the closed amount paid to the member who brought the lead in. */
  commissionPct: number;
  active: boolean;
  notes: string;
}

export interface GroupStats {
  key: string;
  leads: number;
  open: number;
  demos: number;
  won: number;
  lost: number;
  /** won / (won + lost), null when nothing closed yet. */
  winRate: number | null;
  /** won / leads. */
  conversion: number;
  revenue: Record<string, number>;
}

/** Leads grouped by any key (source, campaign, marketer…), biggest group first. Archived leads are ignored. */
export function groupStats(leads: Lead[], keyOf: (l: Lead) => string | null | undefined): GroupStats[] {
  const map = new Map<string, GroupStats>();
  for (const l of leads) {
    if (l.archived) continue;
    const key = keyOf(l) || '—';
    const g = map.get(key) ?? { key, leads: 0, open: 0, demos: 0, won: 0, lost: 0, winRate: null, conversion: 0, revenue: {} };
    g.leads++;
    if (isOpen(l)) g.open++;
    if (l.demoAt || l.status === 'demo_booked' || l.status === 'demo_done') g.demos++;
    if (l.status === 'closed_won') {
      g.won++;
      g.revenue[l.currency] = (g.revenue[l.currency] ?? 0) + (l.closedAmount || 0);
    }
    if (l.status === 'closed_lost') g.lost++;
    map.set(key, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, winRate: g.won + g.lost ? g.won / (g.won + g.lost) : null, conversion: g.leads ? g.won / g.leads : 0 }))
    .sort((a, b) => b.leads - a.leads || a.key.localeCompare(b.key));
}

/** Commission owed per currency to a member for the won leads they brought in. */
export function commissionFor(member: Pick<TeamMember, 'id' | 'commissionPct'>, leads: Lead[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!member.commissionPct) return out;
  for (const l of leads) {
    if (l.archived || l.status !== 'closed_won' || l.marketerId !== member.id) continue;
    out[l.currency] = (out[l.currency] ?? 0) + ((l.closedAmount || 0) * member.commissionPct) / 100;
  }
  return out;
}

/** Open leads nobody has touched for `days` days and with no call booked — they are going cold. */
export function staleLeads(leads: Lead[], days = 7, now = Date.now()): Lead[] {
  const cutoff = now - days * 86_400_000;
  return leads
    .filter((l) => isOpen(l) && !l.nextCallAt && (l.lastActivityAt ?? l.createdAt ?? l.leadDate ?? now) < cutoff)
    .sort((a, b) => (a.lastActivityAt ?? a.createdAt ?? 0) - (b.lastActivityAt ?? b.createdAt ?? 0));
}

/** Pipeline funnel: how many (non-archived) leads reached at least each stage. */
export function funnel(leads: Lead[]): { stage: string; count: number }[] {
  const live = leads.filter((l) => !l.archived);
  const contacted = live.filter((l) => l.status !== 'new' || l.callsMade > 0);
  const reached = live.filter((l) => !['new', 'not_answered'].includes(l.status) || l.demoAt);
  const demo = live.filter((l) => l.demoAt || ['demo_booked', 'demo_done', 'negotiation', 'closed_won'].includes(l.status));
  const demoDone = live.filter((l) => ['demo_done', 'negotiation', 'closed_won'].includes(l.status));
  const won = live.filter((l) => l.status === 'closed_won');
  return [
    { stage: 'Leads', count: live.length },
    { stage: 'Contacted', count: contacted.length },
    { stage: 'Spoke / interested', count: reached.length },
    { stage: 'Demo booked', count: demo.length },
    { stage: 'Demo done', count: demoDone.length },
    { stage: 'Won', count: won.length },
  ];
}
