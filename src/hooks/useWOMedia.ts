import { useState, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { db, storage } from '../lib/firebase';
import type { WorkOrder, WODocument, DocumentFileType } from '../types/workOrder';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface UploadProgress {
  fileName: string;
  progress: number;
}

interface UseWOMediaResult {
  uploadMedia: (woId: string, siteId: string, files: File[]) => Promise<boolean>;
  removeMedia: (woId: string, currentDocs: WODocument[], docId: string) => Promise<boolean>;
  progress: UploadProgress[];
  uploading: boolean;
  error: string | null;
}

// Per-type size caps (bytes). Video allowed up to 200 MB for field capture.
const SIZE_CAPS: Record<DocumentFileType, number> = {
  image: 50 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  cad: 100 * 1024 * 1024,
  compressed: 200 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  sop_link: 0,
};

function detectFileType(file: File): DocumentFileType {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return 'video';
  }
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) {
    return 'cad';
  }
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return 'compressed';
  }
  return 'document';
}

function uploadOne(
  file: File,
  storagePath: string,
  onProgress: (p: number) => void,
): Promise<string> {
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file);
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

export function useWOMedia(): UseWOMediaResult {
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const uploadMedia = useCallback(
    async (woId: string, siteId: string, files: File[]): Promise<boolean> => {
      if (!user) return false;
      if (files.length === 0) return true;

      setUploading(true);
      setError(null);

      // Validate size caps up front.
      for (const file of files) {
        const type = detectFileType(file);
        if (file.size > SIZE_CAPS[type]) {
          const cap = Math.round(SIZE_CAPS[type] / (1024 * 1024));
          const msg = `${file.name} exceeds the ${cap} MB limit for ${type} files.`;
          setError(msg);
          toast.error(msg);
          setUploading(false);
          return false;
        }
      }

      const progressMap: Record<string, number> = {};
      setProgress(files.map((f) => ({ fileName: f.name, progress: 0 })));

      try {
        const docs: WODocument[] = await Promise.all(
          files.map(async (file) => {
            const fileType = detectFileType(file);
            const storagePath = `workorders/${siteId}/${woId}/field-media/${Date.now()}_${file.name}`;
            const url = await uploadOne(file, storagePath, (p) => {
              progressMap[file.name] = p;
              setProgress(files.map((f) => ({ fileName: f.name, progress: progressMap[f.name] ?? 0 })));
            });
            return {
              id: nanoid(),
              name: file.name,
              fileType,
              format: file.name.split('.').pop()?.toUpperCase() ?? '',
              url,
              storagePath,
              fileSize: file.size,
              uploadedBy: user.uid,
              uploadedByName: user.displayName ?? '',
              uploadedAt: Timestamp.now(),
              isCompletionDocument: false,
            };
          }),
        );

        await updateDoc(doc(db, 'workOrders', woId), {
          documents: arrayUnion(...docs),
          updatedAt: serverTimestamp(),
        });

        toast.success(files.length === 1 ? 'Media uploaded.' : `${files.length} files uploaded.`);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Media upload failed';
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setUploading(false);
        setProgress([]);
      }
    },
    [user],
  );

  const removeMedia = useCallback(
    async (woId: string, currentDocs: WODocument[], docId: string): Promise<boolean> => {
      try {
        const next = currentDocs.filter((d) => d.id !== docId);
        await updateDoc(doc(db, 'workOrders', woId), {
          documents: next,
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Remove failed';
        setError(msg);
        toast.error(msg);
        return false;
      }
    },
    [],
  );

  return { uploadMedia, removeMedia, progress, uploading, error };
}
