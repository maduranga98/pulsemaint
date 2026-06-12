import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import type { TriageMediaRef } from '../../types/triage';

export type TriageFileKind = 'image' | 'video' | 'file';

/** Classify a File into the kinds the triage viewer can render. */
export function classifyTriageFile(file: File): TriageFileKind {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

/** Map a kind to the TriageMediaRef.type (only image|video are supported there). */
export function mediaRefTypeFor(kind: TriageFileKind): TriageMediaRef['type'] {
  return kind === 'video' ? 'video' : 'image';
}

function rand() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Upload a triage media/reference file to Firebase Storage and return a
 * permanent download URL. Replaces the in-memory blob: URLs that die on reload.
 */
export async function uploadTriageMedia(
  file: File,
  opts: { companyId?: string; folder?: string } = {},
): Promise<{ url: string; kind: TriageFileKind; name: string }> {
  const folder = opts.folder ?? 'reference';
  const company = opts.companyId || 'shared';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `triage/${company}/${folder}/${rand()}_${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, kind: classifyTriageFile(file), name: file.name };
}
