import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloudSyncProvider,
  applyDifficultChanges,
  getFirebaseSignInErrorMessage,
  parseCloudDifficultSettings,
  parseCloudNote,
  readAttemptChanges,
  uploadEach,
  useCloudSync,
} from '@/components/cloud-sync-provider';
import { dailyActivityRecord } from '@/features/practice/daily-practice-recording';

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: {
      attempts: [],
      notes: {},
      noteUpdatedAt: {},
      difficultQuestionIds: [],
    },
    dispatch: vi.fn(),
    hydrated: true,
  }),
}));

function Probe() {
  const cloud = useCloudSync();
  return <output aria-label="cloud status">{cloud.status}</output>;
}

describe('CloudSyncProvider', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '');
  });

  it('keeps the site in local-only mode when Firebase is not configured', () => {
    render(
      <CloudSyncProvider>
        <Probe />
      </CloudSyncProvider>,
    );

    expect(screen.getByLabelText('cloud status')).toHaveTextContent('disabled');
  });

  it('parses versioned cloud notes and rejects malformed records', () => {
    expect(
      parseCloudNote({
        questionId: 'law-114-01',
        content: '跨裝置筆記',
        updatedAt: '2026-08-06T10:00:00.000Z',
      }),
    ).toEqual({
      questionId: 'law-114-01',
      content: '跨裝置筆記',
      updatedAt: '2026-08-06T10:00:00.000Z',
    });
    expect(parseCloudNote({ questionId: 'law-114-01' })).toBeNull();
  });

  it('normalizes the cloud difficult-question list', () => {
    expect(
      parseCloudDifficultSettings({
        questionIds: [
          'law-114-02',
          'law-114-01',
          'law-114-02',
          42,
          null,
        ],
      }),
    ).toEqual(['law-114-01', 'law-114-02']);
    expect(parseCloudDifficultSettings({ questionIds: 'law-114-01' })).toBeNull();
  });

  it('applies only pending mark changes to the latest cloud list', () => {
    expect(applyDifficultChanges(
      ['law-114-01', 'env-113-02'],
      { 'law-114-01': false, 'structure-113-03': true },
    )).toEqual(['env-113-02', 'structure-113-03']);
  });

  it('reports actionable Google sign-in errors', () => {
    expect(getFirebaseSignInErrorMessage({ code: 'auth/unauthorized-domain' }))
      .toContain('Authorized domains');
    expect(getFirebaseSignInErrorMessage({ code: 'auth/operation-not-allowed' }))
      .toContain('啟用 Google 登入');
    expect(getFirebaseSignInErrorMessage({ code: 'auth/network-request-failed' }))
      .toContain('檢查網路');
  });

  it('keeps uploading the other records when the server refuses one', async () => {
    const upload = vi.fn((record: { id: string }) =>
      record.id === 'practice'
        ? Promise.reject(new Error('permission-denied'))
        : Promise.resolve(),
    );

    await expect(
      uploadEach([{ id: 'paper' }, { id: 'practice' }, { id: 'later' }], upload),
    ).resolves.toEqual({ synced: ['paper', 'later'], failed: true });
    expect(upload).toHaveBeenCalledTimes(3);
    await expect(uploadEach([{ id: 'paper' }], upload)).resolves.toEqual({
      synced: ['paper'],
      failed: false,
    });
  });

  it('accepts a count-only daily activity record from the cloud without restoring answers', () => {
    const summary = dailyActivityRecord({
      id: 'daily-practice-test', mode: 'practice', subject: 'law', year: null,
      questionIds: ['law-114-01'], answers: { 'law-114-01': 0 },
      startedAt: '2026-10-20T00:00:00.000Z', submittedAt: '2026-10-20T00:01:00.000Z',
      elapsedSeconds: 60, correctCount: 1, wrongCount: 0, unansweredCount: 0,
    })!;
    const confirmed = new Set<string>();
    const changes = readAttemptChanges([{
      type: 'added', id: summary.id, data: { ...summary, syncedAt: {} }, pending: false,
    }], confirmed);
    expect(changes).toEqual({ incoming: [summary], removed: [] });
    expect(confirmed.has(summary.id)).toBe(true);
    expect(changes.incoming[0].questionIds).toEqual([]);
    expect(changes.incoming[0].answers).toEqual({});
  });

  it('keeps a record the server refused, but removes one deleted on another device', () => {
    const record = {
      id: 'attempt-practice',
      mode: 'practice',
      subject: 'law',
      year: null,
      questionIds: ['law-114-01'],
      answers: { 'law-114-01': 0 },
      startedAt: '2026-10-20T00:00:00.000Z',
      submittedAt: '2026-10-20T00:01:00.000Z',
      elapsedSeconds: 60,
      correctCount: 1,
      wrongCount: 0,
      unansweredCount: 0,
    };
    const confirmed = new Set(['attempt-old']);

    // This device's write echoes back, then the server refuses it and the SDK rolls it back.
    expect(
      readAttemptChanges([{ type: 'added', id: record.id, data: record, pending: true }], confirmed),
    ).toEqual({ incoming: [record], removed: [] });
    expect(
      readAttemptChanges([{ type: 'removed', id: record.id, data: record, pending: false }], confirmed),
    ).toEqual({ incoming: [], removed: [] });

    // A record the server accepted and another device deleted goes here too.
    expect(
      readAttemptChanges([{ type: 'removed', id: 'attempt-old', data: {}, pending: false }], confirmed),
    ).toEqual({ incoming: [], removed: ['attempt-old'] });
    readAttemptChanges([{ type: 'added', id: record.id, data: record, pending: false }], confirmed);
    expect(confirmed.has(record.id)).toBe(true);
    // Retired 隨機出題 records are not read back.
    expect(
      readAttemptChanges(
        [{ type: 'added', id: 'random', data: { ...record, id: 'random', mode: 'random' }, pending: false }],
        confirmed,
      ).incoming,
    ).toEqual([]);
  });
});
