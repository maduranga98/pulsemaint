// ---------------------------------------------------------------------------
// Per-user notification preferences (stored at users/{uid}.notificationPrefs)
// ---------------------------------------------------------------------------

export type NotificationChannel = 'push' | 'email';

export type NotificationEventType =
  | 'breakdown'
  | 'woAssigned'
  | 'slaBreach'
  | 'lowStock'
  | 'mention'
  | 'safetyAlert'
  | 'pmDue'
  | 'partsRequest'
  | 'handover';

export interface ChannelPref {
  push: boolean;
  email: boolean;
}

export type NotificationPrefs = Record<NotificationEventType, ChannelPref>;

export interface NotificationEventDef {
  type: NotificationEventType;
  label: string;
  description: string;
  /** High-severity events default to push + email; the rest to push only. */
  highSeverity: boolean;
}

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  { type: 'breakdown', label: 'Breakdowns', description: 'New breakdown reported on your machines.', highSeverity: true },
  { type: 'slaBreach', label: 'SLA Breach', description: 'A work order or breakdown has breached its SLA.', highSeverity: true },
  { type: 'safetyAlert', label: 'Safety Alerts', description: 'LOTO/PTW and other safety-critical alerts.', highSeverity: true },
  { type: 'woAssigned', label: 'Work Order Assigned', description: 'You have been assigned to a work order.', highSeverity: false },
  { type: 'mention', label: 'Mentions', description: 'Someone @mentions you in a comment.', highSeverity: false },
  { type: 'lowStock', label: 'Low Stock', description: 'A part has dropped to/below its minimum level.', highSeverity: false },
  { type: 'pmDue', label: 'PM Due', description: 'A preventive maintenance task is due or overdue.', highSeverity: false },
  { type: 'partsRequest', label: 'Parts Requests', description: 'Parts request status updates.', highSeverity: false },
  { type: 'handover', label: 'Shift Handover', description: 'Handover submitted / awaiting acceptance.', highSeverity: false },
];

/** Default channels: push+email for high-severity, push-only otherwise. */
export function defaultPrefFor(def: NotificationEventDef): ChannelPref {
  return { push: true, email: def.highSeverity };
}

export function defaultNotificationPrefs(): NotificationPrefs {
  const out = {} as NotificationPrefs;
  for (const def of NOTIFICATION_EVENTS) {
    out[def.type] = defaultPrefFor(def);
  }
  return out;
}

/** Merge stored prefs over defaults so new event types are always present. */
export function withDefaults(stored: Partial<NotificationPrefs> | undefined | null): NotificationPrefs {
  const base = defaultNotificationPrefs();
  if (!stored) return base;
  for (const def of NOTIFICATION_EVENTS) {
    const s = stored[def.type];
    if (s) base[def.type] = { push: !!s.push, email: !!s.email };
  }
  return base;
}
