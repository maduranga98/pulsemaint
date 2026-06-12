import { useState, useRef, useCallback } from 'react';
import {
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UseLessonProgressReturn {
  updateVideoProgress: (
    assignmentId: string,
    lessonId: string,
    watchedSeconds: number,
    totalSeconds: number
  ) => void;
  markLessonComplete: (
    assignmentId: string,
    lessonId: string,
    totalLessons: number,
    currentLessonsCompleted: number
  ) => Promise<void>;
  markAssignmentComplete: (assignmentId: string) => Promise<void>;
  isUpdating: boolean;
}

const DEBOUNCE_MS = 5000;
const AUTO_COMPLETE_THRESHOLD = 80;

export function useLessonProgress(): UseLessonProgressReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ---------------------------------------------------------------------------
  // updateVideoProgress — debounced write
  // ---------------------------------------------------------------------------
  const updateVideoProgress = useCallback(
    (
      assignmentId: string,
      lessonId: string,
      watchedSeconds: number,
      totalSeconds: number
    ) => {
      const key = `${assignmentId}_${lessonId}`;

      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }

      debounceTimers.current[key] = setTimeout(async () => {
        const percentComplete =
          totalSeconds > 0
            ? Math.min(100, Math.round((watchedSeconds / totalSeconds) * 100))
            : 0;

        const autoComplete = percentComplete >= AUTO_COMPLETE_THRESHOLD;

        try {
          setIsUpdating(true);
          const assignmentRef = doc(db, 'trainingAssignments', assignmentId);

          await updateDoc(assignmentRef, {
            [`lessonProgress.${lessonId}.watchedSeconds`]: watchedSeconds,
            [`lessonProgress.${lessonId}.percentComplete`]: percentComplete,
            ...(autoComplete
              ? {
                  [`lessonProgress.${lessonId}.completed`]: true,
                  [`lessonProgress.${lessonId}.completedAt`]: serverTimestamp(),
                }
              : {}),
            lastActivityAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Failed to update video progress:', err);
        } finally {
          setIsUpdating(false);
          delete debounceTimers.current[key];
        }
      }, DEBOUNCE_MS);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // markLessonComplete — immediate write
  // ---------------------------------------------------------------------------
  const markLessonComplete = useCallback(
    async (
      assignmentId: string,
      lessonId: string,
      totalLessons: number,
      currentLessonsCompleted: number
    ) => {
      try {
        setIsUpdating(true);
        const assignmentRef = doc(db, 'trainingAssignments', assignmentId);

        // Increment completed count (guard against double-counting by the caller)
        const newLessonsCompleted = Math.min(
          totalLessons,
          currentLessonsCompleted + 1
        );
        const overallProgress =
          totalLessons > 0
            ? Math.round((newLessonsCompleted / totalLessons) * 100)
            : 0;

        await updateDoc(assignmentRef, {
          [`lessonProgress.${lessonId}.completed`]: true,
          [`lessonProgress.${lessonId}.completedAt`]: serverTimestamp(),
          [`lessonProgress.${lessonId}.percentComplete`]: 100,
          lessonsCompleted: newLessonsCompleted,
          overallProgress,
          lastActivityAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to mark lesson complete:', err);
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // markAssignmentComplete — finalize an assignment (acknowledgement /
  // completion of a module that has no quiz or practical sign-off).
  // ---------------------------------------------------------------------------
  const markAssignmentComplete = useCallback(async (assignmentId: string) => {
    try {
      setIsUpdating(true);
      await updateDoc(doc(db, 'trainingAssignments', assignmentId), {
        status: 'certified',
        overallProgress: 100,
        completedAt: serverTimestamp(),
        certifiedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to mark assignment complete:', err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { updateVideoProgress, markLessonComplete, markAssignmentComplete, isUpdating };
}
