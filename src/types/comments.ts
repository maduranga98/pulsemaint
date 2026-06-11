import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Threaded comments (Work Orders & machine profiles)
// ---------------------------------------------------------------------------

export interface CommentMention {
  userId: string;
  userName: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  mentions: CommentMention[];
  attachmentUrls: string[];
  createdAt: Timestamp;
  editedAt?: Timestamp | null;
  deleted?: boolean;
}

/** Parent record a comment thread is attached to. */
export type CommentParentType = 'workOrders' | 'machines';

// ---------------------------------------------------------------------------
// Per-user in-app notifications (topbar inbox)
// ---------------------------------------------------------------------------

export type UserNotificationType = 'mention' | 'comment' | 'system';

export interface UserNotification {
  id: string;
  userId: string;
  companyId: string;
  type: UserNotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  fromId: string | null;
  fromName: string | null;
  sourceType: CommentParentType | null;
  sourceId: string | null;
  createdAt: Timestamp;
}
