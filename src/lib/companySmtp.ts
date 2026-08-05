import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface CompanySmtpStatus {
  configured: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
}

export interface CompanySmtpInput {
  companyId: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export async function getCompanySmtpStatus(companyId: string): Promise<CompanySmtpStatus> {
  const fn = httpsCallable(functions, 'getCompanySmtpStatus');
  const res = await fn({ companyId });
  return res.data as CompanySmtpStatus;
}

export async function setCompanySmtpSettings(input: CompanySmtpInput): Promise<void> {
  const fn = httpsCallable(functions, 'setCompanySmtpSettings');
  await fn(input);
}

export async function removeCompanySmtpSettings(companyId: string): Promise<void> {
  const fn = httpsCallable(functions, 'removeCompanySmtpSettings');
  await fn({ companyId });
}
