export type CompanyApproval = 'pending' | 'approved' | 'rejected';

/**
 * Registration approval state of a company. Self-registered companies start
 * 'pending' until a Lumora superadmin approves them; companies created
 * before approvals existed have no field and count as approved.
 */
export function companyApproval(status: string | null | undefined): CompanyApproval {
  return status === 'pending' || status === 'rejected' ? status : 'approved';
}
