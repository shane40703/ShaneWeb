/**
 * What this browser already holds of one account's cloud 作答紀錄 and 筆記, so a page load
 * asks the server only for what was synced since, not for both whole collections. It keeps
 * ids and versions only; the records themselves live in the app state. The account's
 * deletion log on the server is read and written here too: the deleted ids it lists are what
 * the checkpoint mirrors.
 */
import {
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

export const CLOUD_SYNC_CHECKPOINT_PREFIX = 'shaneweb:cloud-sync:';
/**
 * The deletion log keeps the latest 1000 deleted attempts, and so does the checkpoint: a
 * device that has not loaded since more than that many deletions may send an older one back.
 * The rules hold the log to the same size.
 */
export const DELETED_ATTEMPTS_KEPT = 1000;
/**
 * How often a page load reads again the records this app could not read, in case a later
 * version of the app can. Records no version reads any more would cost reads at every load.
 */
export const OTHER_ATTEMPTS_RECHECK_MS = 24 * 60 * 60 * 1000;

export interface CloudSyncCheckpoint {
  version: 1;
  /** The latest server syncedAt seen on the attempts, in ms rounded down. */
  attemptsAfter: number;
  /** The same for the notes. */
  notesAfter: number;
  /** Attempts confirmed to exist on the server. */
  attemptIds: string[];
  /**
   * Server attempt records this app cannot read. The server's count includes them; they are
   * never held, removed or sent from here.
   */
  otherAttemptIds: string[];
  /**
   * When a page load last read all of `otherAttemptIds` itself, in ms of this device's clock.
   * 0 once a page lists one it did not check: a page open since before a new version of the
   * app wrote a record cannot read it, though the next load may.
   */
  otherCheckedAt: number;
  /**
   * Attempts deleted from the server: the ids of the account's deletion log, and the
   * deletions this browser saw itself. A tab that never heard of one can save the record back
   * into this browser's data; listed here, it is dropped, not sent again, and a copy the
   * server holds again is deleted again.
   */
  deletedAttemptIds: string[];
  /** The note version (its updatedAt) confirmed on the server, by question. */
  noteVersions: Record<string, string>;
}

export interface CloudSyncCheckpointUpdate {
  attemptsAfter?: number;
  notesAfter?: number;
  attemptIds?: readonly string[];
  otherAttemptIds?: readonly string[];
  /** Set by a page load that has read every record this app cannot read. */
  otherCheckedAt?: number;
  noteVersions?: Readonly<Record<string, string>>;
  /** Attempts no longer known to be on the server: they come back once it confirms them. */
  removedAttemptIds?: readonly string[];
  /** Attempts deleted from the server: they leave and stay listed as deleted. */
  deletedAttemptIds?: readonly string[];
  /**
   * Versions the server holds although this device has newer ones (another device's late
   * write). They replace the stored version instead of losing to it, so the newer one is
   * offered again after a reload.
   */
  replaceNoteVersions?: Readonly<Record<string, string>>;
}

/** The parts of the app state a checkpoint vouches for. */
export interface CloudSyncLocalRecords {
  attempts: readonly { id: string }[];
  deletedAttemptIds: readonly string[];
  noteUpdatedAt: Readonly<Record<string, string>>;
}

const storageKey = (uid: string) => CLOUD_SYNC_CHECKPOINT_PREFIX + uid;

function isWatermark(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string');
}

/** Anything but a well-formed version 1 checkpoint counts as none. */
export function parseCloudSyncCheckpoint(value: unknown): CloudSyncCheckpoint | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  // A checkpoint saved before these lists and their check time existed has none of them.
  const {
    attemptIds,
    otherAttemptIds = [],
    otherCheckedAt = 0,
    deletedAttemptIds = [],
    noteVersions,
  } = data;
  if (
    data.version !== 1 ||
    !isWatermark(data.attemptsAfter) ||
    !isWatermark(data.notesAfter) ||
    !isIdList(attemptIds) ||
    !isIdList(otherAttemptIds) ||
    !isWatermark(otherCheckedAt) ||
    !isIdList(deletedAttemptIds) ||
    !noteVersions ||
    typeof noteVersions !== 'object' ||
    Array.isArray(noteVersions) ||
    !Object.values(noteVersions).every((updatedAt) => typeof updatedAt === 'string')
  ) {
    return null;
  }
  return {
    version: 1,
    attemptsAfter: data.attemptsAfter,
    notesAfter: data.notesAfter,
    attemptIds: [...attemptIds],
    otherAttemptIds: [...otherAttemptIds],
    otherCheckedAt,
    deletedAttemptIds: [...deletedAttemptIds],
    noteVersions: Object.fromEntries(Object.entries(noteVersions)),
  };
}

/**
 * Two tabs each add what they saw: the union of ids, the later version of each note, the
 * later watermarks. The ids an update removes and the versions it replaces are the exceptions.
 * An attempt listed as deleted stays deleted and is never confirmed again: the deletion log
 * or this browser saw it go, so a copy the server holds again was sent back by a device that
 * missed the deletion. An attempt the server confirms as readable is no longer another kind.
 * Listing another kind of record unchecked makes the next load read them all again, unless
 * the update says when it read them itself.
 */
export function mergeCloudSyncCheckpoint(
  stored: CloudSyncCheckpoint | null,
  update: CloudSyncCheckpointUpdate,
): CloudSyncCheckpoint {
  const deletedAttemptIds = new Set([
    ...(stored?.deletedAttemptIds ?? []),
    ...(update.deletedAttemptIds ?? []),
  ]);
  const confirmed = new Set(update.attemptIds);
  const leaving = [...(update.removedAttemptIds ?? []), ...deletedAttemptIds];
  const attemptIds = new Set([...(stored?.attemptIds ?? []), ...confirmed]);
  const otherAttemptIds = new Set([
    ...(stored?.otherAttemptIds ?? []),
    ...(update.otherAttemptIds ?? []),
  ]);
  confirmed.forEach((attemptId) => otherAttemptIds.delete(attemptId));
  leaving.forEach((attemptId) => {
    attemptIds.delete(attemptId);
    otherAttemptIds.delete(attemptId);
  });
  const knownOthers = new Set(stored?.otherAttemptIds);
  const otherCheckedAt =
    update.otherCheckedAt ??
    ([...otherAttemptIds].some((attemptId) => !knownOthers.has(attemptId))
      ? 0
      : (stored?.otherCheckedAt ?? 0));
  const noteVersions = new Map(Object.entries(stored?.noteVersions ?? {}));
  Object.entries(update.noteVersions ?? {}).forEach(([questionId, updatedAt]) => {
    if ((noteVersions.get(questionId) ?? '') < updatedAt) {
      noteVersions.set(questionId, updatedAt);
    }
  });
  Object.entries(update.replaceNoteVersions ?? {}).forEach(([questionId, updatedAt]) =>
    noteVersions.set(questionId, updatedAt),
  );
  return {
    version: 1,
    attemptsAfter: Math.max(stored?.attemptsAfter ?? 0, update.attemptsAfter ?? 0),
    notesAfter: Math.max(stored?.notesAfter ?? 0, update.notesAfter ?? 0),
    attemptIds: [...attemptIds],
    otherAttemptIds: [...otherAttemptIds],
    otherCheckedAt,
    deletedAttemptIds: [...deletedAttemptIds].slice(-DELETED_ATTEMPTS_KEPT),
    noteVersions: Object.fromEntries(noteVersions),
  };
}

/**
 * A checkpoint stands only for records this browser still holds. Another tab may have saved
 * older app data over the newer, or storage was cleared: then everything is read again.
 */
export function cloudSyncCheckpointIsValid(
  checkpoint: CloudSyncCheckpoint,
  local: CloudSyncLocalRecords,
) {
  const held = new Set([
    ...local.attempts.map((attempt) => attempt.id),
    ...local.deletedAttemptIds,
  ]);
  return (
    checkpoint.attemptIds.every((attemptId) => held.has(attemptId)) &&
    Object.entries(checkpoint.noteVersions).every(([questionId, updatedAt]) => {
      const localVersion = local.noteUpdatedAt[questionId];
      return typeof localVersion === 'string' && updatedAt <= localVersion;
    })
  );
}

/**
 * Whether this load reads again the records this app could not read: unchecked ones at once,
 * the others once a day. A clock that went back reads them too.
 */
export function otherAttemptsDue(checkpoint: CloudSyncCheckpoint, now: number) {
  const elapsed = now - checkpoint.otherCheckedAt;
  return (
    checkpoint.otherAttemptIds.length > 0 &&
    !(elapsed >= 0 && elapsed < OTHER_ATTEMPTS_RECHECK_MS)
  );
}

/**
 * The attempts a checkpoint lists that a full read the server answered no longer holds. The
 * ones `deleted` lists (the deletion log, or this browser, saw them go) were `deleted`; any
 * other was `lost` by the server (a wipe, a restore, or a deletion an older version of the
 * app did not log), to keep and send again. How many are missing does not matter. This holds
 * for a checkpoint this browser's data no longer covers too: each id it lists was confirmed on
 * the server once.
 */
export function attemptsGoneFromServer(
  confirmedIds: readonly string[],
  onServer: ReadonlySet<string>,
  deleted: ReadonlySet<string>,
): { deleted: string[]; lost: string[] } {
  const missing = confirmedIds.filter((attemptId) => !onServer.has(attemptId));
  return {
    deleted: missing.filter((attemptId) => deleted.has(attemptId)),
    lost: missing.filter((attemptId) => !deleted.has(attemptId)),
  };
}

/**
 * The account's deletion log: { attemptIds, syncedAt }, the latest deleted attempt ids, oldest
 * first. Every device that deletes adds to it, so the others read a deletion from the server
 * instead of guessing it from a count.
 */
export function deletionLogRef(db: Firestore, uid: string) {
  return doc(db, 'users', uid, 'deletions', 'attempts');
}

/** The ids a deletion log lists; none for a malformed one. */
export function parseDeletionLog(data: DocumentData | undefined): string[] {
  const attemptIds: unknown = data?.attemptIds;
  return Array.isArray(attemptIds)
    ? attemptIds.filter((attemptId): attemptId is string => typeof attemptId === 'string')
    : [];
}

/** The log with these deletions added last, each id once, and only the latest kept. */
export function withDeletions(logged: readonly string[], attemptIds: readonly string[]) {
  const added = new Set(attemptIds);
  return [...logged.filter((attemptId) => !added.has(attemptId)), ...added].slice(
    -DELETED_ATTEMPTS_KEPT,
  );
}

/**
 * Deletes these attempts and adds them to the deletion log in one transaction, so no device
 * can see one without the other. It costs one read, of the log. Unlike a plain write it fails
 * offline instead of waiting, after the SDK has tried a few times.
 */
export function deleteAndLogAttempts(
  db: Firestore,
  uid: string,
  attemptIds: readonly string[],
) {
  const log = deletionLogRef(db, uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(log);
    const logged = snapshot.exists() ? parseDeletionLog(snapshot.data()) : [];
    attemptIds.forEach((attemptId) =>
      transaction.delete(doc(db, 'users', uid, 'attempts', attemptId)),
    );
    transaction.set(log, {
      attemptIds: withDeletions(logged, attemptIds),
      syncedAt: serverTimestamp(),
    });
  });
}

/** The stored text as well as what it says, so a save compares without reading again. */
function readStored(uid: string) {
  const raw = window.localStorage.getItem(storageKey(uid));
  let checkpoint: CloudSyncCheckpoint | null = null;
  try {
    checkpoint = raw === null ? null : parseCloudSyncCheckpoint(JSON.parse(raw));
  } catch {
    // Not JSON: no checkpoint, replaced at the next save.
  }
  return { raw, checkpoint };
}

export function loadCloudSyncCheckpoint(uid: string): CloudSyncCheckpoint | null {
  try {
    return readStored(uid).checkpoint;
  } catch {
    return null;
  }
}

/**
 * Reads, merges and writes back, so tabs add to each other's checkpoint instead of replacing
 * it. `fresh` starts over from this update alone, after a full read, but keeps the deletions:
 * a full read cannot tell whether a tab still holds one of those records.
 */
export function saveCloudSyncCheckpoint(
  uid: string,
  update: CloudSyncCheckpointUpdate,
  fresh = false,
) {
  try {
    const { raw, checkpoint: stored } = readStored(uid);
    const base =
      fresh && stored
        ? mergeCloudSyncCheckpoint(null, { deletedAttemptIds: stored.deletedAttemptIds })
        : stored;
    const next = JSON.stringify(mergeCloudSyncCheckpoint(base, update));
    if (raw !== next) window.localStorage.setItem(storageKey(uid), next);
  } catch {
    // An older checkpoint, or none, only costs reads at the next load.
  }
}

/**
 * A server syncedAt in whole ms, rounded down so a query from it still includes that record.
 * Null for anything else, such as the null a pending serverTimestamp() reads back as.
 */
export function syncedAtMillis(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const { seconds, nanoseconds } = value as { seconds?: unknown; nanoseconds?: unknown };
  if (typeof seconds !== 'number' || !Number.isInteger(seconds)) return null;
  const nanos = typeof nanoseconds === 'number' ? nanoseconds : 0;
  const millis = seconds * 1000 + Math.floor(nanos / 1_000_000);
  return Number.isSafeInteger(millis) && millis >= 0 ? millis : null;
}
