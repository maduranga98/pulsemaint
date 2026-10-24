/**
 * One-line explanation of each launcher app, shown by the guided tour on the
 * phone launcher. Keyed by the last part of the nav label key
 * (`common.nav.items.<key>`); the text is looked up as `tour.launcher.<key>`
 * in the locale files and falls back to this English wording.
 */
export const LAUNCHER_DESCRIPTIONS: Record<string, string> = {
  dashboard: 'Your home screen: the key numbers, factory floor, what needs sign-off and who is on shift.',
  machines: 'The register of every machine: its QR code, health score, history and documents.',
  breakdowns: 'Report a breakdown and follow it from "reported" to repaired and closed.',
  workOrders: 'Create, assign, track and sign off maintenance work orders.',
  myWorkOrders: 'The work orders assigned to you — start, complete and log your work here.',
  pmSchedules: 'Preventive maintenance schedules and what is due today or overdue.',
  workPermits: 'Permit-to-work: request, approve and track permits for risky jobs.',
  safetyCases: 'Report and follow up incidents, near misses, hazards and unsafe acts.',
  safetyTrainings: 'Schedule safety training sessions and review submissions.',
  safetyBlacklist: 'People and contractors who are barred from site work.',
  inventory: 'Spare parts catalogue and stock levels, with low-stock alerts.',
  po: 'Purchase orders: raise, approve, receive and chase deliveries.',
  requests: 'Parts requests from the floor waiting for the store.',
  requestsInbox: 'Requests sent to you that need an answer or approval.',
  myRequests: 'Requests you have sent and where each one stands.',
  triage: 'Step-by-step troubleshooting guides, quizzes and who to call.',
  training: 'The training library and the courses assigned to people.',
  traineeManagement: 'Trainee programmes, assignments and sign-offs.',
  myTraining: 'Your assigned trainings and quizzes.',
  myProgram: 'Your trainee programme and how far along you are.',
  myCertificates: 'Certificates you have earned.',
  contractors: 'Contractor companies, their team members and jobs.',
  myShift: 'Your shift: start and end it and see who is on with you.',
  shiftHandovers: 'Handover notes between shifts and past handovers.',
  analytics: 'Charts and trends: breakdowns, costs, MTBF/MTTR and team performance.',
  moe: 'Management of change records.',
  reports: 'Ready-made reports you can generate and download.',
  audit: 'Audits: checklists, findings and completed audits.',
  evaluations: 'Staff evaluations.',
  settings: 'Company settings: users, plants, departments, shifts and data export.',
  billing: 'Your plan, invoices and payment details.',
  supportRequests: 'Messages to the FirmiCore team and their replies.',
  help: 'Step-by-step guides for the tools your role uses.',
};

/** `common.nav.items.machines` → `machines`; `common.nav.dashboard` → `dashboard`. */
export function launcherKeyOf(labelKey: string): string {
  return labelKey.split('.').pop() ?? labelKey;
}
