import { describe, it, expect } from 'vitest';
import { extensionForMime, formatDuration, pickRecordingMime } from '../platform/callRecording';

describe('call recording helpers', () => {
  it('prefers WebM Opus, falls back, or reports none', () => {
    expect(pickRecordingMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickRecordingMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecordingMime(() => false)).toBeNull();
  });
  it('maps mime types', () => {
    expect(extensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForMime('audio/mp4')).toBe('m4a');
  });
  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
  });
});
