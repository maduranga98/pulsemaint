import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronLeft, Copy, ExternalLink, Loader2, MonitorPlay } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import {
  LANGUAGE_NATIVE_NAMES,
  displayUrl,
  type DepartmentDisplayLink,
  type DisplayDepartmentRow,
} from '@/lib/departmentDisplay';
import { listDepartmentDisplays, manageDepartmentDisplay, type ManageDisplayAction } from '@/services/departmentDisplay.service';
import { usePlantsInUse } from '@/hooks/usePlantsInUse';

// Supervisor / plant manager / admin: share a department's live board as a link, or stop sharing it.
// The server decides which departments each role may share (functions/src/displays/departmentDisplays.js).

type Pending = { key: string; action: 'stop' | 'regenerate' } | null;

const rowKey = (r: DisplayDepartmentRow) => `${r.plantId}\u0000${r.name}`;

export default function DepartmentDisplaysPage() {
  const { t } = useTranslation();
  const plantsInUse = usePlantsInUse();
  const [rows, setRows] = useState<DisplayDepartmentRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listDepartmentDisplays());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (row: DisplayDepartmentRow, action: ManageDisplayAction, language?: string) => {
    const key = rowKey(row);
    setBusy(key);
    setConfirm(null);
    try {
      const display = await manageDepartmentDisplay({ action, plantId: row.plantId, department: row.name, language });
      setRows((cur) => (cur ? cur.map((r) => (rowKey(r) === key ? { ...r, display } : r)) : cur));
      const messages: Record<ManageDisplayAction, string> = {
        start: t('displaySharing.toast.started', 'Sharing started'),
        stop: t('displaySharing.toast.stopped', 'Sharing stopped'),
        regenerate: t('displaySharing.toast.regenerated', 'New link created'),
        setLanguage: t('displaySharing.toast.language', 'Language saved'),
      };
      toast.success(messages[action]);
    } catch {
      toast.error(t('displaySharing.toast.error', 'Could not save. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('displaySharing.toast.copied', 'Link copied'));
    } catch {
      toast.error(t('displaySharing.toast.copyFailed', 'Could not copy. Select the link and copy it by hand.'));
    }
  };

  return (
    <div className="min-h-full">
      <div className="border-b border-slate-200 pb-5">
        <Link to="/app/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-4 h-4" />
          {t('common.settings.page.title', 'Settings')}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{t('displaySharing.title', 'Department display')}</h1>
        <p className="text-sm text-slate-500">
          {t('displaySharing.subtitle', "Share a department's live breakdowns, maintenance and schedule on a TV or phone. Anyone with the link can view it; nobody can change anything from it.")}
        </p>
      </div>

      <div className="pt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {rows === null && !loadError && (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />{t('displaySharing.loading', 'Loading…')}</div>
          )}
          {loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {t('displaySharing.loadError', 'Could not load your departments.')}{' '}
              <button type="button" onClick={() => void load()} className="font-medium underline">{t('displaySharing.retry', 'Try again')}</button>
            </div>
          )}
          {rows !== null && rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              {t('displaySharing.empty', 'There is no department you can share yet. Departments are created under a plant.')}
            </div>
          )}
          {rows?.map((row) => {
            const key = rowKey(row);
            const d: DepartmentDisplayLink | null = row.display;
            const url = d ? displayUrl(d.token, window.location.origin) : '';
            const working = busy === key;
            return (
              <section key={key} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <MonitorPlay className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900 truncate">{row.name}</h2>
                      {plantsInUse && row.plantName && <p className="text-xs text-slate-500 truncate">{row.plantName}</p>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${d?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {d?.enabled ? t('displaySharing.on', 'Sharing is on') : t('displaySharing.off', 'Not shared')}
                  </span>
                </div>

                {d?.enabled && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label htmlFor={`link-${key}`} className="block text-xs font-medium text-slate-500 mb-1">
                        {t('displaySharing.link', 'Link (works on any device, no login, never expires)')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <input
                          id={`link-${key}`}
                          readOnly
                          value={url}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 basis-64 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700"
                        />
                        <button type="button" onClick={() => void copy(url)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          <Copy className="w-4 h-4" />{t('displaySharing.copy', 'Copy link')}
                        </button>
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          <ExternalLink className="w-4 h-4" />{t('displaySharing.open', 'Open')}
                        </a>
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`lang-${key}`} className="block text-xs font-medium text-slate-500 mb-1">
                        {t('displaySharing.language', 'Language the screen opens in')}
                      </label>
                      <select
                        id={`lang-${key}`}
                        value={d.language}
                        disabled={working}
                        onChange={(e) => void run(row, 'setLanguage', e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{LANGUAGE_NATIVE_NAMES[l.code] ?? l.label}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">{t('displaySharing.languageNote', 'People at the screen can switch language themselves.')}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!d?.enabled && (
                    <button type="button" disabled={working} onClick={() => void run(row, 'start')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                      {working && <Loader2 className="w-4 h-4 animate-spin" />}{t('displaySharing.start', 'Start sharing')}
                    </button>
                  )}
                  {d?.enabled && (
                    <>
                      <button type="button" disabled={working} onClick={() => setConfirm({ key, action: 'regenerate' })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                        {t('displaySharing.newLink', 'Make a new link')}
                      </button>
                      <button type="button" disabled={working} onClick={() => setConfirm({ key, action: 'stop' })} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60">
                        {t('displaySharing.stop', 'Stop sharing')}
                      </button>
                    </>
                  )}
                </div>

                {confirm?.key === key && (
                  <div role="alertdialog" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-semibold">
                      {confirm.action === 'stop'
                        ? t('displaySharing.confirmStopTitle', 'Stop sharing this department?')
                        : t('displaySharing.confirmNewTitle', 'Make a new link?')}
                    </p>
                    <p className="mt-1">
                      {confirm.action === 'stop'
                        ? t('displaySharing.confirmStopBody', 'The link stops working right away. Screens that have it open will show "Display is off". Sharing again later gives the same link back.')
                        : t('displaySharing.confirmNewBody', 'The old link stops working. Update every TV and phone that uses it.')}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => void run(row, confirm.action)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
                        {t('displaySharing.yes', 'Yes, continue')}
                      </button>
                      <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        {t('displaySharing.cancel', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="space-y-4">
          <section className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-600">
            <h2 className="font-semibold text-slate-900 mb-2">{t('displaySharing.shows.heading', 'What the link shows')}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{t('displaySharing.shows.breakdowns', 'Breakdowns: open ones and the ones fixed today, with progress and time since reported. Signed-off ones are not shown.')}</li>
              <li>{t('displaySharing.shows.maintenance', 'Maintenance today: work running now and work still to do today (maintenance and PM).')}</li>
              <li>{t('displaySharing.shows.scheduled', 'Scheduled: everything planned after today, up to a year ahead, grouped by month. Overdue PM is not shown.')}</li>
              <li>{t('displaySharing.shows.language', 'One language at a time. People at the screen pick from every language FirmiCore supports.')}</li>
              <li>{t('displaySharing.shows.hidden', 'Never shown: technician names, costs, parts, notes, photos, signed-off work.')}</li>
            </ul>
          </section>
          <section className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-600">
            <h2 className="font-semibold text-slate-900 mb-2">{t('displaySharing.good.heading', 'Good to know')}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{t('displaySharing.good.anyone', 'Anyone who has the link can see the board, so share it only on the shop floor.')}</li>
              <li>{t('displaySharing.good.stop', 'Stop sharing turns the link off at once.')}</li>
              <li>{t('displaySharing.good.new', 'Make a new link when a link was passed on by mistake.')}</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
