import type { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/**
 * storage.rules only lets a user touch files of the company named in the
 * `companyId` claim on their login token (set by the onUserMappingWritten /
 * syncCompanyClaim Cloud Functions). Accounts created before the claim
 * existed — or a token minted a moment before sign-up finished — lack it, so
 * after sign-in we ask the server to set it and refresh the token.
 */
export async function ensureCompanyClaim(user: User, companyId: string): Promise<void> {
  if (user.isAnonymous) return;
  const token = await user.getIdTokenResult();
  if (token.claims.companyId === companyId) return;
  await httpsCallable<void, { companyId: string | null; changed: boolean }>(functions, 'syncCompanyClaim')();
  await user.getIdToken(true);
}
