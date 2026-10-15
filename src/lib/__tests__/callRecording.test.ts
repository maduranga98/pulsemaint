import { describe, it, expect } from 'vitest';
import { analysisToNote, canTranscribe, extensionForMime, formatDuration, pickRecordingMime } from '../platform/callRecording';

describe('call recording helpers', () => {
  it('prefers WebM Opus, falls back, or reports none', () => {
    expect(pickRecordingMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickRecordingMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecordingMime(() => false)).toBeNull();
  });
  it('maps mime types', () => {
    expect(extensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForMime('audio/mp4')).toBe('m4a');
    expect(canTranscribe('audio/webm')).toBe(true);
    expect(canTranscribe('audio/mp4')).toBe(false);
  });
  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
  });
  it('builds the call note', () => {
    expect(analysisToNote({ summary: 'Wants a demo.', requirements: ['PM scheduling'], followUps: ['Call Friday'] }))
      .toBe('Wants a demo.\n\nNeeds:\n• PM scheduling\n\nNext steps:\n• Call Friday');
    expect(analysisToNote({ summary: '', requirements: [], followUps: [] })).toBe('');
  });
});
