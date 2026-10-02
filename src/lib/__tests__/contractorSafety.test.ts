import { describe, it, expect } from 'vitest';
import {
  MAX_SAFETY_TRAINING_ATTEMPTS,
  addMonths,
  buildSafetyCardUrl,
  buildSafetyTrainingLink,
  getFinalAttempt,
  getFinalScore,
  getInviteAccess,
  getInviteDisplayStatus,
  isSafetyCardValid,
  parseSafetyCardScan,
} from '../safety/contractorSafety';
// The Cloud Function's pure helpers are plain CJS with no firebase-admin
// import, so they can be exercised here without credentials.
// @ts-ignore — no type declarations for the functions package
import * as logic from '../../../functions/src/safetyTraining/logic.js';
// @ts-ignore — no type declarations for the functions package
import * as email from '../../../functions/src/safetyTraining/email.js';

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
    const tooMany = Array.from({ length: logic.MAX_IMAGES + 1 }, () => ({ name: 'a', mimeType: 'image/jpeg', data: png }));
    expect(() => logic.validateAttachments(tooMany)).toThrow(new RegExp(`up to ${logic.MAX_IMAGES} images`));
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

  it('ignores fields it does not know, such as a certificate link sent by an older open form', () => {
    const out = logic.validateAttachments([{ name: 'nvq.jpg', mimeType: 'image/jpeg', data: png, qualificationIndex: 1 }]);
    expect(out).toHaveLength(1);
    expect(out[0].qualificationIndex).toBeUndefined();
  });
});

describe('final submission only', () => {
  const attempt = (n: number, score: number | null) =>
    ({ attemptNumber: n, score, attachments: [] }) as never;

  it('has no final attempt or score before anything is submitted', () => {
    expect(getFinalAttempt({ attempts: [] })).toBeNull();
    expect(getFinalScore({ attempts: [], latestScore: null })).toBeNull();
  });

  it('uses the single stored attempt as the final one', () => {
    const inv = { attempts: [attempt(2, 70)], latestScore: 70 };
    expect(getFinalAttempt(inv)?.attemptNumber).toBe(2);
    expect(getFinalScore(inv)).toBe(70);
  });

  it('reads the last of several attempts stored by older invites, never the best', () => {
    const inv = { attempts: [attempt(1, 95), attempt(2, 40)], latestScore: 40 };
    expect(getFinalAttempt(inv)?.attemptNumber).toBe(2);
    expect(getFinalScore(inv)).toBe(40);
  });

  it('has no score for a submission without a quiz', () => {
    expect(getFinalScore({ attempts: [attempt(1, null)], latestScore: null })).toBeNull();
  });
});

describe('invite email', () => {
  const link = 'https://app.example.com/safety-training/tok_ABCDEFGHIJKLMNOP';
  const built = email.buildInviteEmail(
    { moduleTitle: 'LOTO <b>', technicianName: 'Kasun', contractorName: 'Veltrona', assignedByName: 'Safety Officer', maxAttempts: 3 },
    link,
    { companyName: 'Natrico Pvt Ltd', plantName: 'Newyork', timezone: 'Asia/Colombo' },
    Date.UTC(2026, 9, 2, 10, 7),
  );
  const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ');

  it('puts the link on the button only — the raw URL is not printed under it', () => {
    expect(built.html.match(new RegExp(`href="${link}"`, 'g'))).toHaveLength(1);
    expect(built.html).toContain('Open safety training form');
    expect(visibleText(built.html)).not.toContain('https://');
    expect(visibleText(built.html)).not.toContain('app.example.com');
  });

  it('keeps the link in the plain-text alternative for text-only mail clients', () => {
    expect(built.text).toContain(link);
  });

  it('shows the due time in the company timezone and escapes the training title', () => {
    expect(built.html).toContain('(Asia/Colombo)');
    expect(built.html).toContain('15:37');
    expect(built.html).toContain('LOTO &lt;b&gt;');
    expect(built.html).not.toContain('LOTO <b>');
  });
});

describe('applyFinalSubmission (server)', () => {
  const file = (path: string) => ({ path, url: `https://x/${path}`, kind: 'image' });
  const entry = { attemptNumber: 2, score: 60, submittedAt: 'T2', attachments: [file('a2/new.jpg')] };

  it('keeps only the new submission and carries the count', () => {
    const cur = { attempts: [{ attemptNumber: 1, score: 90, attachments: [file('a1/old.jpg')] }], attemptsUsed: 1 };
    const { update } = logic.applyFinalSubmission(cur, entry);
    expect(update.attempts).toEqual([entry]);
    expect(update.attemptsUsed).toBe(2);
    expect(update.latestScore).toBe(60);
    expect(update.status).toBe('submitted');
    expect(update.lastSubmittedAt).toBe('T2');
  });

  it('no longer writes a best score — the final one is what counts', () => {
    const { update } = logic.applyFinalSubmission({ attempts: [], attemptsUsed: 0 }, entry);
    expect(update).not.toHaveProperty('bestScore');
  });

  it('flags the replaced attempt’s files for deletion, not the new ones', () => {
    const cur = { attempts: [{ attachments: [file('a1/old.jpg'), file('a1/voice.webm')] }], attemptsUsed: 1 };
    expect(logic.applyFinalSubmission(cur, entry).replacedFiles).toEqual(['a1/old.jpg', 'a1/voice.webm']);
  });

  it('cleans up every earlier attempt of an older invite that stored several', () => {
    const cur = {
      attempts: [
        { attachments: [file('a1/x.jpg')] },
        { attachments: [file('a2/y.jpg'), { url: 'no-path' }] },
        { attachments: [] },
      ],
      attemptsUsed: 3,
    };
    expect(logic.applyFinalSubmission(cur, { ...entry, attemptNumber: 4 }).replacedFiles).toEqual(['a1/x.jpg', 'a2/y.jpg']);
  });

  it('has nothing to delete on a first submission', () => {
    expect(logic.applyFinalSubmission({ attempts: undefined }, { ...entry, attemptNumber: 1 }).replacedFiles).toEqual([]);
  });
});
