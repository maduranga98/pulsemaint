import { createContext, useContext } from 'react';
import type { RecordAccessGrant } from '@/types/recordAccessGrant';

/**
 * Records shared with the signed-in requester, loaded once by MyRequestsPage
 * and read by each request card (grantees can only query their own grants,
 * not a request's).
 */
export const MyGrantsContext = createContext<RecordAccessGrant[]>([]);

export function useMyGrants(): RecordAccessGrant[] {
  return useContext(MyGrantsContext);
}
