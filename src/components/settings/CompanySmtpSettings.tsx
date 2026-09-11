import { useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Mail, CheckCircle2, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import {
  getCompanySmtpStatus,
  setCompanySmtpSettings,
  removeCompanySmtpSettings,
  type CompanySmtpStatus,
} from '@/lib/companySmtp';
import { detectSmtpPreset } from '@/lib/smtpProviderPresets';

// Lets an admin/plant manager configure the company's own SMTP mailbox so
// supplier emails (PO sent/priced/cancelled, delivery receipt) send from
// the company's own address instead of the shared platform mailbox. The
// password is never read back from the server — once saved, only
// host/port/user are shown, matching what the deny-all Firestore rule on
// the credentials doc already enforces server-side.
export function CompanySmtpSettings() {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const companyEmail = useAuthStore((s) => s.company?.email) ?? '';
  const { addToast } = useToast();

  const [status, setStatus] = useState<CompanySmtpStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('465');
  const [secure, setSecure] = useState(true);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await getCompanySmtpStatus(companyId);
        if (!cancelled) setStatus(s);
      } catch (err) {
        console.error('Failed to load SMTP status', err);
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  function startEdit() {
    // First-time setup — prefill from the company's registered email and,
    // for well-known providers (Gmail, Outlook, Yahoo, iCloud, Zoho), the
    // matching SMTP host/port/SSL, so the admin only has to paste a
    // password. Editing an already-configured mailbox keeps its own saved
    // values instead of re-guessing from the preset.
    if (!status?.configured) {
      const preset = detectSmtpPreset(companyEmail);
      setHost(preset?.host ?? '');
      setPort(String(preset?.port ?? 465));
      setSecure(preset?.secure ?? true);
      setUser(companyEmail);
    } else {
      setHost(status.host ?? '');
      setPort(String(status.port ?? 465));
      setSecure(status.secure ?? true);
      setUser(status.user ?? '');
    }
    setPass('');
    setEditing(true);
  }

  async function handleSave() {
    if (!companyId || !host.trim() || !port.trim() || !user.trim() || !pass.trim()) {
      addToast(t('common.settings.smtp.validationError', 'Host, port, username, and password are all required.'), 'error');
      return;
    }
    setSaving(true);
    try {
      await setCompanySmtpSettings({
        companyId,
        host: host.trim(),
        port: Number(port),
        secure,
        user: user.trim(),
        pass,
      });
      const s = await getCompanySmtpStatus(companyId);
      setStatus(s);
      setEditing(false);
      setPass('');
      addToast(t('common.settings.smtp.savedToast', 'Email sending configured — supplier emails will now send from this mailbox.'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.settings.smtp.saveFailedToast', 'Failed to save SMTP settings.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!companyId) return;
    if (!confirm(t('common.settings.smtp.confirmRemove', 'Remove this mailbox? Supplier emails will go back to sending from the shared platform mailbox.'))) return;
    setRemoving(true);
    try {
      await removeCompanySmtpSettings(companyId);
      setStatus({ configured: false });
      addToast(t('common.settings.smtp.removedToast', 'Removed. Supplier emails will use the shared platform mailbox again.'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.settings.smtp.removeFailedToast', 'Failed to remove SMTP settings.'), 'error');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-1">
        <Mail className="w-5 h-5 text-slate-500" />
        <h2 className="font-semibold text-slate-900">{t('common.settings.smtp.heading', 'Email Sending')}</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        {t(
          'common.settings.smtp.description',
          "Configure your own mailbox so supplier emails (purchase orders, delivery receipts) send from your company's own address instead of the shared FirmiCore mailbox. Host/port are pre-filled automatically for common providers (Gmail, Outlook, Yahoo, iCloud, Zoho) based on your registered company email — you'll just need to add the password.",
        )}
      </p>

      {loadingStatus ? (
        <p className="text-sm text-slate-400">{t('common.settings.smtp.loading', 'Loading…')}</p>
      ) : editing ? (
        <div className="space-y-3 max-w-md">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.smtp.fields.host', 'SMTP Host')}</label>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder={t('common.settings.smtp.fields.hostPlaceholder', 'smtp.yourcompany.com')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.smtp.fields.port', 'Port')}</label>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                inputMode="numeric"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
                {t('common.settings.smtp.fields.useSsl', 'Use SSL/TLS (usually port 465)')}
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.smtp.fields.username', 'Email / Username')}</label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={t('common.settings.smtp.fields.usernamePlaceholder', 'billing@yourcompany.com')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.settings.smtp.fields.password', 'Password / App Password')}</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={status?.configured ? t('common.settings.smtp.fields.passwordPlaceholderChange', 'Re-enter to change') : ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {host === 'smtp.gmail.com' && (
              <p className="text-xs text-slate-500 mt-1">
                <Trans
                  t={t}
                  i18nKey="common.settings.smtp.fields.gmailHint"
                  components={{
                    link: (
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      />
                    ),
                  }}
                />
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? t('common.settings.smtp.saving', 'Testing & Saving…') : t('common.settings.smtp.save', 'Save & Verify')}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
            >
              {t('common.settings.smtp.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-3">
          {status?.configured ? (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <Trans
                t={t}
                i18nKey="common.settings.smtp.configured"
                values={{ user: status.user, host: status.host }}
                components={{ strong: <strong /> }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <XCircle className="w-4 h-4 text-slate-400" />
              {t('common.settings.smtp.notConfigured', 'Not configured — supplier emails send from the shared platform mailbox.')}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={startEdit}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              {status?.configured ? t('common.settings.smtp.edit', 'Edit') : t('common.settings.smtp.configure', 'Configure')}
            </button>
            {status?.configured && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {removing ? t('common.settings.smtp.removing', 'Removing…') : t('common.settings.smtp.remove', 'Remove')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
