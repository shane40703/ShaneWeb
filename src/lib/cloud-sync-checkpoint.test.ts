import { Timestamp } from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attemptsGoneFromServer,
  CLOUD_SYNC_CHECKPOINT_PREFIX,
  cloudSyncCheckpointIsValid,
  DELETED_ATTEMPTS_KEPT,
  loadCloudSyncCheckpoint,
  mergeCloudSyncCheckpoint,
  OTHER_ATTEMPTS_RECHECK_MS,
  otherAttemptsDue,
  parseCloudSyncCheckpoint,
  parseDeletionLog,
  saveCloudSyncCheckpoint,
  syncedAtMillis,
  withDeletions,
  type CloudSyncCheckpoint,
} from '@/lib/cloud-sync-checkpoint';

const key = `${CLOUD_SYNC_CHECKPOINT_PREFIX}u1`;

function checkpoint(overrides: Partial<CloudSyncCheckpoint> = {}): CloudSyncCheckpoint {
  return {
    version: 1,
    attemptsAfter: 2_000,
    notesAfter: 1_000,
    attemptIds: ['attempt-a', 'attempt-b'],
    otherAttemptIds: [],
    otherCheckedAt: 0,
    deletedAttemptIds: [],
    noteVersions: { 'law-114-01': '2026-11-12T10:00:00.000Z' },
    ...overrides,
  };
}

const stored = () => JSON.parse(localStorage.getItem(key) ?? 'null');

describe('cloud sync checkpoint', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('keeps one checkpoint per account', () => {
    saveCloudSyncCheckpoint('u1', { attemptIds: ['attempt-a'], attemptsAfter: 5 });
    saveCloudSyncCheckpoint('u2', { attemptIds: ['attempt-z'] });
    expect(loadCloudSyncCheckpoint('u1')).toEqual({
      version: 1,
      attemptsAfter: 5,
      notesAfter: 0,
      attemptIds: ['attempt-a'],
      otherAttemptIds: [],
      otherCheckedAt: 0,
      deletedAttemptIds: [],
      noteVersions: {},
    });
    expect(loadCloudSyncCheckpoint('u2')?.attemptIds).toEqual(['attempt-z']);
    expect(loadCloudSyncCheckpoint('u3')).toBeNull();
  });

  it.each([
    ['not JSON', '{'],
    ['another version', JSON.stringify({ ...checkpoint(), version: 2 })],
    ['a negative watermark', JSON.stringify({ ...checkpoint(), attemptsAfter: -1 })],
    ['a fractional watermark', JSON.stringify({ ...checkpoint(), notesAfter: 1.5 })],
    ['ids that are not strings', JSON.stringify({ ...checkpoint(), attemptIds: [1] })],
    [
      'other ids that are not strings',
      JSON.stringify({ ...checkpoint(), otherAttemptIds: [1] }),
    ],
    [
      'deleted ids that are not a list',
      JSON.stringify({ ...checkpoint(), deletedAttemptIds: 'attempt-a' }),
    ],
    ['a negative check time', JSON.stringify({ ...checkpoint(), otherCheckedAt: -1 })],
    [
      'versions that are not strings',
      JSON.stringify({ ...checkpoint(), noteVersions: { a: 1 } }),
    ],
    ['a list of versions', JSON.stringify({ ...checkpoint(), noteVersions: [] })],
    ['nothing', 'null'],
  ])('reads %s as no checkpoint', (_name, raw) => {
    localStorage.setItem(key, raw);
    expect(loadCloudSyncCheckpoint('u1')).toBeNull();
  });

  it('reads no checkpoint when storage refuses access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    expect(loadCloudSyncCheckpoint('u1')).toBeNull();
  });

  it('keeps the old checkpoint when storage refuses the write', () => {
    localStorage.setItem(key, JSON.stringify(checkpoint()));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(() =>
      saveCloudSyncCheckpoint('u1', { attemptIds: ['attempt-c'] }),
    ).not.toThrow();
    expect(stored()).toEqual(checkpoint());
  });

  it('reads storage once per save', () => {
    localStorage.setItem(key, JSON.stringify(checkpoint()));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    saveCloudSyncCheckpoint('u1', { attemptIds: ['attempt-a'] });
    expect(getItem).toHaveBeenCalledTimes(1);
    // Nothing new: the stored text is not written again.
    expect(setItem).not.toHaveBeenCalled();
    saveCloudSyncCheckpoint('u1', { attemptIds: ['attempt-c'] });
    expect(getItem).toHaveBeenCalledTimes(2);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(stored().attemptIds).toEqual(['attempt-a', 'attempt-b', 'attempt-c']);
  });

  it('merges by union of ids, the later version of each note and the later watermarks', () => {
    expect(
      mergeCloudSyncCheckpoint(checkpoint(), {
        attemptsAfter: 1_500,
        notesAfter: 3_000,
        attemptIds: ['attempt-b', 'attempt-c'],
        noteVersions: {
          'law-114-01': '2026-11-12T09:00:00.000Z',
          'law-114-02': '2026-11-12T11:00:00.000Z',
        },
      }),
    ).toEqual({
      version: 1,
      attemptsAfter: 2_000,
      notesAfter: 3_000,
      attemptIds: ['attempt-a', 'attempt-b', 'attempt-c'],
      otherAttemptIds: [],
      otherCheckedAt: 0,
      deletedAttemptIds: [],
      noteVersions: {
        'law-114-01': '2026-11-12T10:00:00.000Z',
        'law-114-02': '2026-11-12T11:00:00.000Z',
      },
    });
  });

  it('subtracts the ids an update removes, even ones it also lists', () => {
    expect(
      mergeCloudSyncCheckpoint(checkpoint(), {
        attemptIds: ['attempt-c'],
        removedAttemptIds: ['attempt-a', 'attempt-c', 'attempt-unknown'],
      }).attemptIds,
    ).toEqual(['attempt-b']);
  });

  it('lists server records of another kind apart, until they become readable or leave', () => {
    const merged = mergeCloudSyncCheckpoint(checkpoint({ otherAttemptIds: ['x-1'] }), {
      otherAttemptIds: ['x-2', 'x-3', 'x-4'],
    });
    expect(merged.otherAttemptIds).toEqual(['x-1', 'x-2', 'x-3', 'x-4']);
    const next = mergeCloudSyncCheckpoint(merged, {
      // x-2 now reads as an attempt; x-3 is gone; x-4 was deleted.
      attemptIds: ['x-2'],
      removedAttemptIds: ['x-3'],
      deletedAttemptIds: ['x-4'],
    });
    expect(next.otherAttemptIds).toEqual(['x-1']);
    expect(next.attemptIds).toEqual(['attempt-a', 'attempt-b', 'x-2']);
  });

  it('counts records of another kind unchecked once a page lists one it did not read itself', () => {
    const checked = checkpoint({ otherAttemptIds: ['x-1'], otherCheckedAt: 5_000 });
    // Listed again, or one leaving, changes nothing.
    expect(
      mergeCloudSyncCheckpoint(checked, { otherAttemptIds: ['x-1'] }).otherCheckedAt,
    ).toBe(5_000);
    expect(
      mergeCloudSyncCheckpoint(checked, { attemptIds: ['x-1'] }).otherCheckedAt,
    ).toBe(5_000);
    // A new one, from a page that may be older than the record, is read at the next load.
    expect(
      mergeCloudSyncCheckpoint(checked, { otherAttemptIds: ['x-2'] }).otherCheckedAt,
    ).toBe(0);
    // Unless the page that lists it says when it read them all.
    expect(
      mergeCloudSyncCheckpoint(checked, {
        otherAttemptIds: ['x-2'],
        otherCheckedAt: 9_000,
      }).otherCheckedAt,
    ).toBe(9_000);
  });

  describe('reads the records of another kind again', () => {
    const day = OTHER_ATTEMPTS_RECHECK_MS;
    const listed = (otherCheckedAt: number) =>
      checkpoint({ otherAttemptIds: ['x-1'], otherCheckedAt });

    it('never while there are none', () => {
      expect(otherAttemptsDue(checkpoint(), 10 * day)).toBe(false);
    });

    it('at once when unchecked, then once a day', () => {
      expect(otherAttemptsDue(listed(0), 10 * day)).toBe(true);
      expect(otherAttemptsDue(listed(10 * day), 11 * day - 1)).toBe(false);
      expect(otherAttemptsDue(listed(10 * day), 11 * day)).toBe(true);
    });

    it('when the clock went back', () => {
      expect(otherAttemptsDue(listed(10 * day), 10 * day - 1)).toBe(true);
    });
  });

  describe('tells attempts deleted elsewhere from attempts the server lost', () => {
    const ids = (count: number) =>
      Array.from({ length: count }, (_, index) => `attempt-${index}`);

    it('by the deleted list alone, however many are missing', () => {
      const confirmed = ids(30);
      const onServer = new Set(confirmed.slice(25));
      expect(
        attemptsGoneFromServer(confirmed, onServer, new Set(['attempt-1', 'attempt-27'])),
      ).toEqual({
        deleted: ['attempt-1'],
        lost: confirmed.slice(0, 25).filter((id) => id !== 'attempt-1'),
      });
      // One missing is lost too when nothing lists it.
      expect(attemptsGoneFromServer(ids(3), new Set(ids(2)), new Set())).toEqual({
        deleted: [],
        lost: ['attempt-2'],
      });
      expect(
        attemptsGoneFromServer(confirmed, new Set([]), new Set(confirmed)).deleted,
      ).toEqual(confirmed);
    });

    it('and nothing while the server holds them all', () => {
      const confirmed = ids(30);
      expect(
        attemptsGoneFromServer(confirmed, new Set(confirmed), new Set(['attempt-1'])),
      ).toEqual({ deleted: [], lost: [] });
    });
  });

  it('lists deletions apart from the ids it removes, and never confirms a deleted one again', () => {
    const deleted = mergeCloudSyncCheckpoint(checkpoint(), {
      deletedAttemptIds: ['attempt-a'],
      removedAttemptIds: ['attempt-b'],
    });
    expect(deleted).toMatchObject({ attemptIds: [], deletedAttemptIds: ['attempt-a'] });
    // A device that missed the deletion sent it back: the server holding it undoes nothing.
    expect(
      mergeCloudSyncCheckpoint(deleted, { attemptIds: ['attempt-a', 'attempt-c'] }),
    ).toMatchObject({ attemptIds: ['attempt-c'], deletedAttemptIds: ['attempt-a'] });
    // Nor when one update lists it both ways.
    expect(
      mergeCloudSyncCheckpoint(checkpoint(), {
        attemptIds: ['attempt-d'],
        otherAttemptIds: ['attempt-e'],
        deletedAttemptIds: ['attempt-d', 'attempt-e'],
      }),
    ).toMatchObject({
      attemptIds: ['attempt-a', 'attempt-b'],
      otherAttemptIds: [],
      deletedAttemptIds: ['attempt-d', 'attempt-e'],
    });
  });

  describe('the deletion log', () => {
    it('reads the ids a log lists, and none from a malformed one', () => {
      expect(parseDeletionLog({ attemptIds: ['attempt-a', 'attempt-b'] })).toEqual([
        'attempt-a',
        'attempt-b',
      ]);
      expect(parseDeletionLog({ attemptIds: ['attempt-a', 7, null] })).toEqual([
        'attempt-a',
      ]);
      expect(parseDeletionLog({ attemptIds: 'attempt-a' })).toEqual([]);
      expect(parseDeletionLog({})).toEqual([]);
      expect(parseDeletionLog(undefined)).toEqual([]);
    });

    it('adds deletions last, each once, keeping the latest', () => {
      expect(
        withDeletions(
          ['attempt-a', 'attempt-b', 'attempt-c'],
          ['attempt-b', 'attempt-d'],
        ),
      ).toEqual(['attempt-a', 'attempt-c', 'attempt-b', 'attempt-d']);
      const full = Array.from(
        { length: DELETED_ATTEMPTS_KEPT },
        (_, index) => `d-${index}`,
      );
      const next = withDeletions(full, ['d-new', 'd-new']);
      expect(next).toHaveLength(DELETED_ATTEMPTS_KEPT);
      expect(next[0]).toBe('d-1');
      expect(next.at(-1)).toBe('d-new');
    });

    it('keeps as many as the rules allow, and the checkpoint keeps as many', () => {
      expect(DELETED_ATTEMPTS_KEPT).toBe(1000);
    });
  });

  it('keeps only the latest deletions', () => {
    const many = Array.from(
      { length: DELETED_ATTEMPTS_KEPT + 5 },
      (_, index) => `d-${index}`,
    );
    const merged = mergeCloudSyncCheckpoint(checkpoint({ deletedAttemptIds: many }), {
      deletedAttemptIds: ['d-new'],
    });
    expect(merged.deletedAttemptIds).toHaveLength(DELETED_ATTEMPTS_KEPT);
    expect(merged.deletedAttemptIds.at(-1)).toBe('d-new');
    expect(merged.deletedAttemptIds).not.toContain('d-0');
  });

  it('lets an older version the server was seen holding replace a newer stored one', () => {
    expect(
      mergeCloudSyncCheckpoint(checkpoint(), {
        noteVersions: { 'law-114-01': '2026-11-12T09:00:00.000Z' },
        replaceNoteVersions: { 'law-114-01': '2026-11-12T09:00:00.000Z' },
      }).noteVersions,
    ).toEqual({ 'law-114-01': '2026-11-12T09:00:00.000Z' });
  });

  it('adds to what another tab saved instead of replacing it', () => {
    // Each tab saves only what it has seen; neither knows about the other's records.
    saveCloudSyncCheckpoint('u1', {
      attemptIds: ['attempt-a'],
      attemptsAfter: 4_000,
      noteVersions: { 'law-114-01': '2026-11-12T10:00:00.000Z' },
    });
    saveCloudSyncCheckpoint('u1', {
      attemptIds: ['attempt-b'],
      attemptsAfter: 3_000,
      notesAfter: 2_000,
      noteVersions: {
        'law-114-01': '2026-11-12T09:00:00.000Z',
        'law-114-02': '2026-11-12T08:00:00.000Z',
      },
    });
    saveCloudSyncCheckpoint('u1', { removedAttemptIds: ['attempt-a'] });
    expect(stored()).toEqual({
      version: 1,
      attemptsAfter: 4_000,
      notesAfter: 2_000,
      attemptIds: ['attempt-b'],
      otherAttemptIds: [],
      otherCheckedAt: 0,
      deletedAttemptIds: [],
      noteVersions: {
        'law-114-01': '2026-11-12T10:00:00.000Z',
        'law-114-02': '2026-11-12T08:00:00.000Z',
      },
    });
  });

  it('starts over from a full read, but keeps the deletions', () => {
    localStorage.setItem(
      key,
      JSON.stringify(
        checkpoint({
          attemptsAfter: 9_000,
          otherAttemptIds: ['x-1'],
          deletedAttemptIds: ['attempt-gone', 'attempt-back'],
        }),
      ),
    );
    // The full read found a copy of attempt-back that a device sent back: still deleted.
    saveCloudSyncCheckpoint(
      'u1',
      { attemptIds: ['attempt-c', 'attempt-back'], attemptsAfter: 3_000 },
      true,
    );
    expect(stored()).toEqual({
      version: 1,
      attemptsAfter: 3_000,
      notesAfter: 0,
      attemptIds: ['attempt-c'],
      otherAttemptIds: [],
      otherCheckedAt: 0,
      deletedAttemptIds: ['attempt-gone', 'attempt-back'],
      noteVersions: {},
    });
  });

  it('replaces corrupt data on the next save', () => {
    localStorage.setItem(key, '{');
    saveCloudSyncCheckpoint('u1', { attemptIds: ['attempt-a'] });
    expect(stored().attemptIds).toEqual(['attempt-a']);
  });

  it('never stores record content', () => {
    saveCloudSyncCheckpoint('u1', {
      attemptIds: ['attempt-a'],
      noteVersions: { 'law-114-01': '2026-11-12T10:00:00.000Z' },
    });
    expect(Object.keys(stored()).sort()).toEqual([
      'attemptIds',
      'attemptsAfter',
      'deletedAttemptIds',
      'noteVersions',
      'notesAfter',
      'otherAttemptIds',
      'otherCheckedAt',
      'version',
    ]);
  });

  describe('is valid', () => {
    const local = {
      attempts: [{ id: 'attempt-a' }],
      deletedAttemptIds: ['attempt-b'],
      noteUpdatedAt: { 'law-114-01': '2026-11-12T10:00:00.000Z' },
    };

    it('while this browser holds every record it lists', () => {
      expect(cloudSyncCheckpointIsValid(checkpoint(), local)).toBe(true);
      // A newer local note, or records it does not list, are fine.
      expect(
        cloudSyncCheckpointIsValid(checkpoint(), {
          attempts: [{ id: 'attempt-a' }, { id: 'attempt-local' }],
          deletedAttemptIds: ['attempt-b'],
          noteUpdatedAt: { 'law-114-01': '2026-11-12T11:00:00.000Z' },
        }),
      ).toBe(true);
    });

    it('not when an attempt it lists is gone from this browser', () => {
      expect(
        cloudSyncCheckpointIsValid(checkpoint(), { ...local, deletedAttemptIds: [] }),
      ).toBe(false);
    });

    it('not when this browser holds an older note than it lists, or none', () => {
      expect(
        cloudSyncCheckpointIsValid(checkpoint(), {
          ...local,
          noteUpdatedAt: { 'law-114-01': '2026-11-12T09:00:00.000Z' },
        }),
      ).toBe(false);
      expect(
        cloudSyncCheckpointIsValid(checkpoint(), { ...local, noteUpdatedAt: {} }),
      ).toBe(false);
    });
  });

  it('reads server timestamps in whole ms, rounded down', () => {
    expect(syncedAtMillis(new Timestamp(1_700_000_000, 123_999_999))).toBe(
      1_700_000_000_123,
    );
    expect(syncedAtMillis({ seconds: 2, nanoseconds: 0 })).toBe(2_000);
    // A pending serverTimestamp() reads back as null.
    expect(syncedAtMillis(null)).toBeNull();
    expect(syncedAtMillis('2026-11-12T10:00:00.000Z')).toBeNull();
    expect(syncedAtMillis({ seconds: 1.5 })).toBeNull();
    // Rounded down, a query from the result still includes the record.
    const exact = new Timestamp(1_700_000_000, 999_999);
    expect(
      Timestamp.fromMillis(syncedAtMillis(exact)!).toMillis() <= exact.toMillis(),
    ).toBe(true);
  });

  it('parses only what it would save', () => {
    expect(parseCloudSyncCheckpoint(checkpoint())).toEqual(checkpoint());
    expect(parseCloudSyncCheckpoint([])).toBeNull();
  });

  it('reads a checkpoint saved without the other and deleted lists as having none', () => {
    const saved: Partial<CloudSyncCheckpoint> = { ...checkpoint() };
    delete saved.otherAttemptIds;
    delete saved.otherCheckedAt;
    delete saved.deletedAttemptIds;
    expect(parseCloudSyncCheckpoint(saved)).toEqual(checkpoint());
  });
});
