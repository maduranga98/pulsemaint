import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import type { Comment, CommentMention, CommentParentType } from '../types/comments';

interface AddCommentInput {
  text: string;
  mentions: CommentMention[];
  attachmentUrls?: string[];
  /** Deep link to the parent record, used for mention notifications. */
  parentLink: string;
  /** Human label of the parent (e.g. WO number / machine name). */
  parentLabel: string;
}

/**
 * Live threaded comments for a parent record. Comments are append-only;
 * authors may edit/delete only their own.
 */
export function useComments(parentType: CommentParentType, parentId: string | undefined) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parentId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, parentType, parentId, 'comments'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Comment)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [parentType, parentId]);

  const addComment = useCallback(
    async (input: AddCommentInput): Promise<boolean> => {
      if (!userProfile || !parentId) return false;
      const text = input.text.trim();
      if (!text) return false;
      try {
        await addDoc(collection(db, parentType, parentId, 'comments'), {
          authorId: userProfile.id,
          authorName: userProfile.fullName ?? 'Unknown',
          text,
          mentions: input.mentions,
          attachmentUrls: input.attachmentUrls ?? [],
          createdAt: serverTimestamp(),
          editedAt: null,
          deleted: false,
        });

        // In-app inbox notification for each mentioned user (push/email is
        // dispatched separately by the Cloud Function, honoring user prefs).
        await Promise.all(
          input.mentions
            .filter((m) => m.userId && m.userId !== userProfile.id)
            .map((m) =>
              addDoc(collection(db, 'userNotifications'), {
                userId: m.userId,
                companyId: userProfile.companyId,
                type: 'mention',
                title: `${userProfile.fullName ?? 'Someone'} mentioned you`,
                body: text.slice(0, 140),
                link: input.parentLink,
                read: false,
                fromId: userProfile.id,
                fromName: userProfile.fullName ?? null,
                sourceType: parentType,
                sourceId: parentId,
                createdAt: serverTimestamp(),
              }),
            ),
        );
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to post comment');
        return false;
      }
    },
    [userProfile, parentType, parentId],
  );

  const editComment = useCallback(
    async (commentId: string, text: string): Promise<boolean> => {
      if (!parentId || !text.trim()) return false;
      try {
        await updateDoc(doc(db, parentType, parentId, 'comments', commentId), {
          text: text.trim(),
          editedAt: Timestamp.now(),
        });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to edit comment');
        return false;
      }
    },
    [parentType, parentId],
  );

  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!parentId) return false;
      try {
        // Soft delete keeps the thread append-only / preserves ordering.
        await updateDoc(doc(db, parentType, parentId, 'comments', commentId), {
          deleted: true,
          text: '',
          mentions: [],
          attachmentUrls: [],
          editedAt: Timestamp.now(),
        });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete comment');
        return false;
      }
    },
    [parentType, parentId],
  );

  return { comments, loading, addComment, editComment, deleteComment };
}
