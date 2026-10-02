import { describe, it, expect } from 'vitest';
import {
  MAX_SAFETY_TRAINING_ATTEMPTS,
  addMonths,
  buildSafetyCardUrl,
  buildSafetyTrainingLink,
  getInviteAccess,
  getInviteDisplayStatus,
  isSafetyCardValid,
  parseSafetyCardScan,
} from '../safety/contractorSafety';
// The Cloud Function's pure helpers are plain CJS with no firebase-admin
// import, so they can be exercised here without credentials.
// @ts-ignore — no type declarations for the functions package
import * as logic from '../../../functions/src/safetyTraining/logic.js';

const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 9, 2, 12, 0, 0);

describe('getInviteAccess', () => {
  const base = { status: 'assigned' as const, attemptsUsed: 0, maxAttempts: 3, dueAtMs: NOW + HOUR };

  it('is open with all attempts before the due time', () => {
    expect(getInviteAccess(base, NOW)).toEqual({ open: true, attemptsRemaining: 3 });
  });

  it('allows retries while attempts remain and the due time has not passed', () => {
    expect(getInviteAccess({ ...base, status: 'submitted', attemptsUsed: 2 }, NOW)).toEqual({
      open: true,
      attemptsRemaining: 1,
    });
  });

  it('closes after the third attempt', () => {
    expect(getInviteAccess({ ...base, status: 'submitted', attemptsUsed: 3 }, NOW)).toEqual({
      open: false,
      reason: 'attempts_exhausted',
    });
  });

  it('closes once the due date and time has passed', () => {
    expect(getInviteAccess(base, NOW + 2 * HOUR)).toEqual({ open: false, reason: 'expired' });
  });

  it('stays open at the exact due moment', () => {
    expect(getInviteAccess(base, base.dueAtMs).open).toBe(true);
  });

  it('closes on sign-off and reassignment regardless of attempts left', () => {
    expect(getInviteAccess({ ...base, status: 'signed_off' }, NOW)).toEqual({ open: false, reason: 'signed_off' });
    expect(getInviteAccess({ ...base, status: 'reassigned' }, NOW)).toEqual({ open: false, reason: 'reassigned' });
  });

  it('falls back to 3 attempts when maxAttempts is missing', () => {
    expect(getInviteAccess({ ...base, maxAttempts: 0 }, NOW)).toEqual({
      open: true,
      attemptsRemaining: MAX_SAFETY_TRAINING_ATTEMPTS,
    });
  });

  it('agrees with the server-side check', () => {
    const cases = [
      { status: 'assigned', attemptsUsed: 0 },
      { status: 'submitted', attemptsUsed: 1 },
      { status: 'submitted', attemptsUsed: 3 },
      { status: 'signed_off', attemptsUsed: 1 },
      { status: 'reassigned', attemptsUsed: 0 },
    ] as const;
    for (const c of cases) {
      for (const now of [NOW, NOW + 2 * HOUR]) {
        const inv = { ...c, maxAttempts: 3 };
        expect(logic.getInviteAccess(inv, base.dueAtMs, now)).toEqual(
          getInviteAccess({ ...inv, dueAtMs: base.dueAtMs }, now),
        );
      }
    }
  });
});

describe('getInviteDisplayStatus', () => {
  const due = NOW + HOUR;
  it('maps invites to the officer-facing status', () => {
    expect(getInviteDisplayStatus({ status: 'assigned', attemptsUsed: 0, dueAtMs: due }, NOW)).toBe('awaiting');
    expect(getInviteDisplayStatus({ status: 'assigned', attemptsUsed: 0, dueAtMs: due }, NOW + 2 * HOUR)).toBe('overdue');
    expect(getInviteDisplayStatus({ status: 'submitted', attemptsUsed: 1, dueAtMs: due }, NOW + 2 * HOUR)).toBe('submitted');
    expect(getInviteDisplayStatus({ status: 'signed_off', attemptsUsed: 2, dueAtMs: due }, NOW)).toBe('signed_off');
    expect(getInviteDisplayStatus({ status: 'reassigned', attemptsUsed: 1, dueAtMs: due }, NOW)).toBe('reassigned');
  });
});

describe('safety card QR payload', () => {
  const id = 'AbCdEfGhIjKlMnOpQrSt';

  it('round-trips through the card URL', () => {
    const url = buildSafetyCardUrl('https://app.example.com/', id);
    expect(url).toBe(`https://app.example.com/safety-card?id=${id}`);
    expect(parseSafetyCardScan(url)).toBe(id);
  });

  it('accepts a JSON payload and a bare id', () => {
    expect(parseSafetyCardScan(JSON.stringify({ type: 'safety_card', id }))).toBe(id);
    expect(parseSafetyCardScan(id)).toBe(id);
  });

  it('rejects other QR codes', () => {
    expect(parseSafetyCardScan('https://app.example.com/scan?machineId=abc&siteId=def')).toBeNull();
    expect(parseSafetyCardScan(JSON.stringify({ type: 'inventory_part', id: 'x' }))).toBeNull();
    expect(parseSafetyCardScan('https://app.example.com/safety-card?id=short')).toBeNull();
    expect(parseSafetyCardScan('')).toBeNull();
    expect(parseSafetyCardScan('PART-001')).toBeNull();
  });
});

describe('training link', () => {
  it('builds the public link without double slashes', () => {
    expect(buildSafetyTrainingLink('https://app.example.com/', 'tok_en-1')).toBe(
      'https://app.example.com/safety-training/tok_en-1',
    );
  });
});

describe('card validity', () => {
  const ts = (ms: number) => ({ toMillis: () => ms }) as never;
  it('is valid only while active and before the expiry', () => {
    expect(isSafetyCardValid({ status: 'active', validUntil: ts(NOW + HOUR) }, NOW)).toBe(true);
    expect(isSafetyCardValid({ status: 'active', validUntil: ts(NOW - HOUR) }, NOW)).toBe(false);
    expect(isSafetyCardValid({ status: 'revoked', validUntil: ts(NOW + HOUR) }, NOW)).toBe(false);
  });

  it('adds months without overflowing short months', () => {
    expect(addMonths(new Date(2026, 0, 31), 1).getMonth()).toBe(1);
    expect(addMonths(new Date(2026, 0, 31), 1).getDate()).toBe(28);
    expect(addMonths(new Date(2026, 9, 2), 12).getFullYear()).toBe(2027);
  });
});

describe('scoreSubmission (server)', () => {
  const quiz = {
    questions: [
      {
        id: 'q1',
        points: 2,
        options: [
          { id: 'a', isCorrect: true },
          { id: 'b', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        points: 1,
        options: [
          { id: 'a', isCorrect: true },
          { id: 'b', isCorrect: true },
          { id: 'c', isCorrect: false },
        ],
      },
    ],
  };

  it('has no marks when the module has no quiz', () => {
    const r = logic.scoreSubmission(null, 80, {});
    expect(r).toMatchObject({ hasQuiz: false, score: null, passed: true });
  });

  it('weights questions by points', () => {
    const r = logic.scoreSubmission(quiz, 60, { q1: ['a'], q2: ['a', 'c'] });
    expect(r.score).toBe(67); // 2 of 3 points
    expect(r.passed).toBe(true);
    expect(r.correctAnswers).toBe(1);
  });

  it('needs every correct option and no wrong one', () => {
    expect(logic.scoreSubmission(quiz, 80, { q1: ['a'], q2: ['a'] }).score).toBe(67);
    expect(logic.scoreSubmission(quiz, 80, { q1: ['a', 'b'], q2: ['a', 'b'] }).score).toBe(33);
    expect(logic.scoreSubmission(quiz, 80, { q1: ['a'], q2: ['a', 'b'] }).score).toBe(100);
  });

  it('fails below the pass mark and ignores ids that are not options', () => {
    const r = logic.scoreSubmission(quiz, 80, { q1: ['zzz'], q2: [] });
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.answers[0].selectedOptionIds).toEqual([]);
  });
});

describe('publicModuleContent (server)', () => {
  it('never exposes correct answers or explanations', () => {
    const out = logic.publicModuleContent({
      title: 'Hot work',
      lessons: [
        { id: 'l2', order: 2, title: 'Second', type: 'text' },
        { id: 'l1', order: 1, title: 'First', type: 'video', contentUrl: 'https://x/y.mp4' },
      ],
      quiz: {
        questions: [
          {
            id: 'q1',
            order: 1,
            text: 'Q?',
            type: 'single_choice',
            explanation: 'because',
            options: [
              { id: 'a', text: 'A', isCorrect: true, explanation: 'secret' },
              { id: 'b', text: 'B', isCorrect: false, explanation: '' },
            ],
          },
        ],
      },
    });
    expect(out.lessons.map((l: { id: string }) => l.id)).toEqual(['l1', 'l2']);
    const json = JSON.stringify(out);
    expect(json).not.toContain('isCorrect');
    expect(json).not.toContain('secret');
    expect(json).not.toContain('because');
  });

  it('treats an empty quiz as no quiz', () => {
    expect(logic.publicModuleContent({ title: 'x', quiz: { questions: [] } }).quiz).toBeNull();
  });
});

describe('validateAttachments (server)', () => {
  const png = Buffer.from('hello').toString('base64');

  it('accepts images and voice recordings, stripping codec parameters', () => {
    const out = logic.validateAttachments([
      { name: 'My Photo!.png', mimeType: 'image/png', data: `data:image/png;base64,${png}` },
      { name: 'note', mimeType: 'audio/webm;codecs=opus', data: png },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'image', name: 'My-Photo.png', sizeBytes: 5 });
    expect(out[1]).toMatchObject({ kind: 'audio', mimeType: 'audio/webm', ext: 'webm' });
  });

  it('rejects other file types', () => {
    expect(() => logic.validateAttachments([{ name: 'x.pdf', mimeType: 'application/pdf', data: png }])).toThrow(
      /images and voice/,
    );
    expect(() => logic.validateAttachments([{ name: 'x.svg', mimeType: 'image/svg+xml', data: png }])).toThrow();
  });

  it('enforces the count and size limits', () => {
    const six = Array.from({ length: 6 }, () => ({ name: 'a', mimeType: 'image/jpeg', data: png }));
    expect(() => logic.validateAttachments(six)).toThrow(/up to 5 images/);
    const three = Array.from({ length: 3 }, () => ({ name: 'a', mimeType: 'audio/webm', data: png }));
    expect(() => logic.validateAttachments(three)).toThrow(/up to 2 voice/);
    const big = Buffer.alloc(logic.MAX_ATTACHMENT_BYTES + 1).toString('base64');
    expect(() => logic.validateAttachments([{ name: 'a', mimeType: 'image/jpeg', data: big }])).toThrow(/too large/);
  });

  it('rejects non-base64 data and empty files', () => {
    expect(() => logic.validateAttachments([{ name: 'a', mimeType: 'image/png', data: '***' }])).toThrow();
    expect(() => logic.validateAttachments([{ name: 'a', mimeType: 'image/png', data: '' }])).toThrow(/empty/);
  });

  it('treats no attachments as fine', () => {
    expect(logic.validateAttachments(undefined)).toEqual([]);
    expect(logic.validateAttachments([])).toEqual([]);
  });
});
