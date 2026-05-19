import type { BreakdownSeverity } from '../types';

// SLA resolution time in milliseconds per severity level
export const SLA_DURATION_MS: Record<BreakdownSeverity, number> = {
  critical: 2  * 60 * 60 * 1000,   // 2 hours
  high:     4  * 60 * 60 * 1000,   // 4 hours
  medium:   8  * 60 * 60 * 1000,   // 8 hours
  low:      24 * 60 * 60 * 1000,   // 24 hours
};

// SLA breach warning threshold — alert this many ms before deadline
export const SLA_WARNING_BEFORE_MS = 30 * 60 * 1000;   // 30 minutes

// Escalation: unacknowledged breakdowns escalated after this duration
export const ESCALATION_UNACKNOWLEDGED_MS = 10 * 60 * 1000;   // 10 minutes

// Auto-close: resolved breakdowns auto-close after this duration
export const AUTO_CLOSE_AFTER_RESOLVED_MS = 24 * 60 * 60 * 1000;   // 24 hours

// Recurring pattern threshold (same machine + type in window)
export const RECURRING_THRESHOLD_COUNT = 3;
export const RECURRING_WINDOW_DAYS = 30;

// Ticket number format: BD-YYYY-XXXX (zero-padded to 4 digits)
export const TICKET_PREFIX = 'BD';
export const TICKET_SEQUENCE_PAD = 4;

// Photo upload limits
export const PHOTO_MAX_COUNT = 5;
export const PHOTO_MAX_SIZE_BYTES = 50 * 1024 * 1024;    // 50 MB
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// Video upload limits
export const VIDEO_MAX_COUNT = 1;
export const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024;    // 50 MB
export const VIDEO_ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

// Digest schedule (used in Cloud Scheduler config)
export const DAILY_DIGEST_HOUR_LOCAL = 7;   // 7:00 AM plant local time

// Scheduler intervals (ms — for reference; actual cron in firebase.json)
export const ESCALATION_CHECK_INTERVAL_MS = 60  * 1000;    // 1 minute
export const SLA_CHECK_INTERVAL_MS        = 5   * 60 * 1000;  // 5 minutes
export const AUTO_CLOSE_CHECK_INTERVAL_MS = 30  * 60 * 1000;  // 30 minutes
