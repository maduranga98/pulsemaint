import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import {
  todayWindow,
  type DepartmentDisplayLink,
  type DisplayData,
  type DisplayDepartmentRow,
} from '@/lib/departmentDisplay';

// Public — no sign-in. Answers { enabled: false } for a stopped, replaced or unknown link.
export async function fetchDepartmentDisplay(token: string): Promise<DisplayData> {
  const fn = httpsCallable<{ token: string; dayStartMs: number; dayEndMs: number }, DisplayData>(
    functions,
    'getDepartmentDisplay',
  );
  const res = await fn({ token, ...todayWindow() });
  return res.data;
}

// Supervisor / plant manager / admin only.
export async function listDepartmentDisplays(): Promise<DisplayDepartmentRow[]> {
  const fn = httpsCallable<void, { departments: DisplayDepartmentRow[] }>(functions, 'listDepartmentDisplays');
  const res = await fn();
  return res.data.departments;
}

export type ManageDisplayAction = 'start' | 'stop' | 'regenerate' | 'setLanguage';

export async function manageDepartmentDisplay(input: {
  action: ManageDisplayAction;
  plantId: string;
  department: string;
  language?: string;
}): Promise<DepartmentDisplayLink> {
  const fn = httpsCallable<typeof input, { display: DepartmentDisplayLink }>(functions, 'manageDepartmentDisplay');
  const res = await fn(input);
  return res.data.display;
}
