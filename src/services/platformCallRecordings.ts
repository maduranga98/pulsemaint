import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { extensionForMime, type CallRecordingInfo } from '@/lib/platform/callRecording';

/** Saves a recorded call under platformLeadCalls/{leadId}/ so it can be played back later. */
export async function uploadCallRecording(leadId: string, blob: Blob, mime: string, durationSec: number): Promise<CallRecordingInfo> {
  const path = `platformLeadCalls/${leadId}/${Date.now()}.${extensionForMime(mime)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: mime.split(';')[0] });
  const url = await getDownloadURL(fileRef);
  return { path, url, mime, durationSec, sizeBytes: blob.size };
}
