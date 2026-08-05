// Known SMTP settings for common email providers, keyed by the email's
// domain — lets the SMTP settings form prefill Host/Port/SSL automatically
// from the company's registered email instead of the admin having to look
// them up. The password (or app-password, for providers that require one
// like Gmail) always still has to be entered by hand — that's the actual
// proof of access, which can't be inferred from the address alone.
export interface SmtpPreset {
  host: string;
  port: number;
  secure: boolean;
}

const KNOWN_PROVIDERS: Record<string, SmtpPreset> = {
  'gmail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
  'googlemail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
  'outlook.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'hotmail.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'live.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'office365.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  'ymail.com': { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  'icloud.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
  'me.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
  'zoho.com': { host: 'smtp.zoho.com', port: 465, secure: true },
};

export function detectSmtpPreset(email: string | null | undefined): SmtpPreset | undefined {
  if (!email) return undefined;
  const domain = email.split('@')[1]?.trim().toLowerCase();
  return domain ? KNOWN_PROVIDERS[domain] : undefined;
}
