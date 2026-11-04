import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setAppLanguage, type AppLanguage } from '@/lib/i18n';
import {
  LANGUAGE_NATIVE_NAMES,
  daysFromToday,
  groupByMonth,
  intlLocale,
  isAllDay,
  progressPercent,
  type DisplayBreakdown,
  type DisplayData,
  type DisplayMaintenance,
  type DisplayScheduled,
} from '@/lib/departmentDisplay';
import { fetchDepartmentDisplay } from '@/services/departmentDisplay.service';
import './departmentDisplay.css';

// Public, read-only board for one department: /display/:token. No login. Opened on a TV or a phone, it
// refreshes itself every 30 s and scrolls long columns on its own. What it shows is decided on the server
// (functions/src/displays/displayLogic.js); this page only draws it, in the app's own font and languages.

const POLL_MS = 30_000;
const THEME_KEY = 'firmicore-display-theme';
// The app stores its language under 'firmicore-language' as soon as it loads, so that key cannot tell whether a person
// at this screen has chosen one. This flag is set only when they pick a language from the drop-down.
const LANG_CHOSEN_KEY = 'firmicore-display-language-chosen';

type PageState = 'loading' | 'ready' | 'off' | 'invalid';

function readTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) === 'light';
  } catch {
    return false;
  }
}

function useAutoScroll(refs: RefObject<HTMLDivElement | null>[], enabled: boolean) {
  const hover = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const state = refs.map(() => ({ dir: 1, wait: 30 }));
    const id = window.setInterval(() => {
      if (hover.current) return;
      refs.forEach((ref, i) => {
        const el = ref.current;
        if (!el || el.scrollHeight <= el.clientHeight + 2) return;
        const s = state[i];
        if (s.wait > 0) {
          s.wait -= 1;
          return;
        }
        el.scrollTop += s.dir;
        if (s.dir > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          s.dir = -1;
          s.wait = 40;
        } else if (s.dir < 0 && el.scrollTop <= 0) {
          s.dir = 1;
          s.wait = 40;
        }
      });
    }, 60);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return hover;
}

function Clock({ locale }: { locale: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="dd-clock">
      <b>{new Date(now).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}</b>
      <span>{new Date(now).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  );
}

function LanguagePicker() {
  const { i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : 'en-US';
  return (
    <select
      aria-label="Language"
      value={current}
      onChange={(e) => {
        try {
          localStorage.setItem(LANG_CHOSEN_KEY, '1');
        } catch {
          // not remembered — the choice still applies now
        }
        setAppLanguage(e.target.value as AppLanguage);
      }}
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {LANGUAGE_NATIVE_NAMES[l.code] ?? l.label}
        </option>
      ))}
    </select>
  );
}

export default function DepartmentDisplayPage() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const locale = intlLocale(language);
  const [data, setData] = useState<DisplayData | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [offline, setOffline] = useState<string | null>(null);
  const [light, setLight] = useState(readTheme);
  const [auto, setAuto] = useState(true);
  const languageApplied = useRef(false);
  const bodies = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const hover = useAutoScroll(bodies, auto);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await fetchDepartmentDisplay(token);
      setOffline(null);
      setData(d);
      setState(d.enabled ? 'ready' : 'off');
      // The supervisor's default language, unless this device already chose one.
      if (d.enabled && !languageApplied.current) {
        languageApplied.current = true;
        let chosen: string | null = null;
        try {
          chosen = localStorage.getItem(LANG_CHOSEN_KEY);
        } catch {
          // storage unavailable: use the link's language
        }
        if (!chosen && SUPPORTED_LANGUAGES.some((l) => l.code === d.language)) void i18n.changeLanguage(d.language);
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'functions/invalid-argument') setState('invalid');
      else setOffline(code ? code.replace('functions/', '') : 'network'); // keep showing the last update
    }
  }, [token, i18n]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Keep the screen awake while the board is open (ignored where the browser refuses it).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === 'visible') lock = await wl.request('screen');
      } catch {
        // not granted — nothing to do
      }
    };
    void request();
    const onVisible = () => void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // The link is a secret: keep it out of search engines, and name the tab after the department.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
  useEffect(() => {
    if (data && data.enabled) document.title = data.department;
  }, [data]);

  const setTheme = (next: boolean) => {
    setLight(next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'light' : 'dark');
    } catch {
      // not saved — still applies now
    }
  };

  const shellClass = `dd-board${light ? ' dd-light' : ''}`;

  if (state === 'loading') {
    return (
      <div className={shellClass}>
        <div className="dd-center"><p>{t('display.loading', 'Loading…')}</p></div>
      </div>
    );
  }
  if (state === 'off' || state === 'invalid' || !data || !data.enabled) {
    return (
      <div className={shellClass}>
        <div className="dd-center">
          <h1>{t('display.offTitle', 'Display is off')}</h1>
          <p>{t('display.offBody', 'Sharing for this department was stopped by the supervisor. Ask your supervisor for the new link.')}</p>
          <div style={{ marginTop: 16 }}><LanguagePicker /></div>
        </div>
      </div>
    );
  }

  const nowMs = Date.now();
  const openBreakdowns = data.breakdowns.filter((b) => b.fixedAt === null);
  const fixedToday = data.breakdowns.filter((b) => b.fixedAt !== null);
  const running = data.maintenance.filter((m) => m.status !== 'scheduled_today');
  const laterToday = data.maintenance.filter((m) => m.status === 'scheduled_today');
  const monthGroups = groupByMonth(data.scheduled, locale);
  const anyFresh = openBreakdowns.some((b) => b.fresh);

  const time = (ms: number) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const typeTag = (type: 'WO' | 'PM') =>
    type === 'PM'
      ? <span className="dd-tag dd-pm">{t('display.tagPM', 'PM')}</span>
      : <span className="dd-tag dd-wo">{t('display.tagWO', 'Maintenance')}</span>;

  const breakdownCard = (b: DisplayBreakdown, i: number) => {
    const color = b.status === 'fixed' ? 'dd-g' : b.status === 'reported' ? 'dd-r' : 'dd-a';
    return (
      <div key={`${b.machine}-${b.at}-${i}`} className={`dd-card ${color}${b.fresh ? ' dd-fresh' : ''}`}>
        <div className="dd-top">
          <div className="dd-name">{b.machine}</div>
          <span className="dd-badge">{t(`display.status.${b.status}`)}</span>
        </div>
        <div className="dd-steps">
          {[0, 1, 2, 3].map((s) => (
            <span key={s} className={s <= b.step ? 'dd-on' : undefined}>{t(`display.step${s}`)}</span>
          ))}
        </div>
        <div className="dd-meta">
          <span>{t('display.reportedAt', 'Reported at')} <b>{time(b.at)}</b></span>
          {b.fixedAt !== null && <span>{t('display.fixedAt', 'Fixed at')} <b>{time(b.fixedAt)}</b></span>}
        </div>
      </div>
    );
  };

  const maintenanceCard = (m: DisplayMaintenance, i: number) => {
    const color = m.status === 'scheduled_today' ? 'dd-a' : 'dd-b';
    return (
      <div key={`${m.machine}-${m.from}-${i}`} className={`dd-card ${color}`}>
        <div className="dd-top">
          <div className="dd-name">{m.machine}</div>
          <span className="dd-badge">{t(`display.status.${m.status}`)}</span>
        </div>
        {m.status === 'running' && (
          <div className="dd-prog"><i style={{ width: `${progressPercent(m.from, m.to, nowMs)}%` }} /></div>
        )}
        <div className="dd-meta">
          {typeTag(m.type)}
          {!isAllDay(m.from) && <b>{time(m.from)}{m.to > m.from ? ` – ${time(m.to)}` : ''}</b>}
        </div>
      </div>
    );
  };

  const scheduledRow = (s: DisplayScheduled, i: number) => {
    const days = daysFromToday(s.from, nowMs);
    return (
      <div key={`${s.machine}-${s.from}-${i}`} className="dd-sched">
        <div className="dd-chip">
          <b>{new Date(s.from).getDate()}</b>
          <span>{new Date(s.from).toLocaleDateString(locale, { weekday: 'short' })}</span>
        </div>
        <div className="dd-name">{s.machine}</div>
        <div className="dd-sright">
          {typeTag(s.type)}
          {!isAllDay(s.from) && <b>{time(s.from)}</b>}
          <span>{days === 1 ? t('display.tomorrow', 'Tomorrow') : t('display.inDays', { n: days, defaultValue: 'In {{n}} days' })}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={shellClass}>
      <header className="dd-head">
        <div>
          <div className="dd-brand"><img src="/logo.svg" alt="" />{t('common.ui2.layout.appLayout.firmicore')}</div>
          <h1 className="dd-title">{[data.plantName, data.department].filter(Boolean).join(' - ')}</h1>
        </div>
        <div className="dd-tools">
          <LanguagePicker />
          <div className="dd-seg">
            <button type="button" aria-pressed={auto} onClick={() => setAuto(true)}>{t('display.autoScroll', 'Auto-scroll')}</button>
            <button type="button" aria-pressed={!auto} onClick={() => setAuto(false)}>{t('display.hold', 'Hold')}</button>
          </div>
          <div className="dd-seg">
            <button type="button" aria-pressed={!light} onClick={() => setTheme(false)}>{t('display.dark', 'Dark')}</button>
            <button type="button" aria-pressed={light} onClick={() => setTheme(true)}>{t('display.light', 'Light')}</button>
          </div>
        </div>
        <Clock locale={locale} />
      </header>
      {offline && <div className="dd-offline" role="status">{t('display.reconnecting', 'No connection · showing the last update')} ({offline})</div>}

      <div
        className="dd-cols"
        onMouseEnter={() => { hover.current = true; }}
        onMouseLeave={() => { hover.current = false; }}
      >
        <section className="dd-col dd-x1">
          <div className="dd-chead">
            <span className="dd-n">{openBreakdowns.length}</span>
            <span className="dd-ct">{t('display.colBD', 'Breakdowns')}</span>
            {anyFresh && <i className="dd-alert" />}
          </div>
          <div className="dd-cbody" ref={bodies[0]}>
            <div className="dd-h3">{t('display.openNow', 'Open now')}</div>
            {openBreakdowns.length
              ? openBreakdowns.map(breakdownCard)
              : <div className="dd-empty">{t('display.noOpen', 'No open breakdowns')}</div>}
            {fixedToday.length > 0 && (
              <>
                <div className="dd-h3">{t('display.fixedToday', 'Fixed today')}</div>
                {fixedToday.map(breakdownCard)}
              </>
            )}
          </div>
        </section>

        <section className="dd-col dd-x2">
          <div className="dd-chead">
            <span className="dd-n">{data.maintenance.length}</span>
            <span className="dd-ct">{t('display.colMT', 'Maintenance today')}</span>
          </div>
          <div className="dd-cbody" ref={bodies[1]}>
            {data.maintenance.length === 0 && <div className="dd-empty dd-empty-muted">{t('display.nothingToday', 'Nothing today')}</div>}
            {running.length > 0 && (
              <>
                <div className="dd-h3">{t('display.runningNow', 'Running now')}</div>
                {running.map(maintenanceCard)}
              </>
            )}
            {laterToday.length > 0 && (
              <>
                <div className="dd-h3">{t('display.laterToday', 'Later today')}</div>
                {laterToday.map(maintenanceCard)}
              </>
            )}
          </div>
        </section>

        <section className="dd-col dd-x3">
          <div className="dd-chead">
            <span className="dd-n">{data.scheduled.length}</span>
            <span className="dd-ct">{t('display.colSC', 'Scheduled')}</span>
          </div>
          <div className="dd-cbody" ref={bodies[2]}>
            {data.scheduled.length === 0 && <div className="dd-empty dd-empty-muted">{t('display.nothingPlanned', 'Nothing planned')}</div>}
            {monthGroups.map((g) => (
              <div key={g.key}>
                <div className="dd-h3">{g.label}</div>
                {g.items.map(scheduledRow)}
              </div>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}
