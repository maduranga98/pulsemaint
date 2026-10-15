import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { functions, storage } from '@/lib/firebase';
import { extensionForMime, type CallAnalysis, type CallRecordingInfo } from '@/lib/platform/callRecording';

/** Saves a recorded call under platformLeadCalls/{leadId}/ so it can be played back later. */
export async function uploadCallRecording(leadId: string, blob: Blob, mime: string, durationSec: number): Promise<CallRecordingInfo> {
  const path = `platformLeadCalls/${leadId}/${Date.now()}.${extensionForMime(mime)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: mime.split(';')[0] });
  const url = await getDownloadURL(fileRef);
  return { path, url, mime, durationSec, sizeBytes: blob.size };
}

/** Transcribes the saved recording and summarises it in the language that was spoken. */
export async function transcribeCallRecording(leadId: string, storagePath: string, languageHint: string): Promise<CallAnalysis> {
  const fn = httpsCallable<{ leadId: string; storagePath: string; languageHint: string }, CallAnalysis>(functions, 'platformTranscribeCall');
  const { data } = await fn({ leadId, storagePath, languageHint });
  return data;
}
