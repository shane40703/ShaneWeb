const PRACTICE_HISTORY_KEY = 'shaneweb:practice-history';
const MAX_TAGGED_ENTRIES = 200;

/**
 * Where a history entry sits in a practice set: the set, and how many entries
 * this tab added for it since the set began. Leaving a set rewinds over its
 * entries, and Back/Forward can tell the entries of a set that is gone.
 *
 * Tags live in this tab's sessionStorage under Next's history key: Next
 * rewrites an entry's state on every Back/Forward but keeps its key, except
 * on a full load.
 */
export interface PracticeHistoryTag {
  set: string;
  depth: number;
}

interface HistoryRecord {
  entries: Record<string, unknown>;
  /** The last tag written and the history length then, for a full reload. */
  last: (PracticeHistoryTag & { length: number }) | null;
}

function isTag(value: unknown): value is PracticeHistoryTag {
  const tag = value as Partial<PracticeHistoryTag> | null;
  return (
    Boolean(tag) &&
    typeof tag!.set === 'string' &&
    Number.isInteger(tag!.depth) &&
    tag!.depth! >= 0
  );
}

function readRecord(): HistoryRecord {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(PRACTICE_HISTORY_KEY) ?? 'null',
    );
    if (
      value &&
      typeof value === 'object' &&
      value.entries &&
      typeof value.entries === 'object'
    ) {
      const last =
        isTag(value.last) && Number.isInteger(value.last.length) ? value.last : null;
      return { entries: value.entries, last };
    }
  } catch {
    // A damaged record only costs the rewind; navigation still works.
  }
  return { entries: {}, last: null };
}

function writeRecord(record: HistoryRecord) {
  try {
    window.sessionStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify(record));
  } catch {
    // Private browsing: leaving a set then keeps its entries.
  }
}

function currentKey() {
  const key = (window.history.state as { key?: unknown } | null)?.key;
  return typeof key === 'string' ? key : null;
}

export function readEntryTag(): PracticeHistoryTag | null {
  const key = currentKey();
  const tag = key ? readRecord().entries[key] : null;
  return isTag(tag) ? tag : null;
}

export function writeEntryTag(tag: PracticeHistoryTag | null) {
  const record = readRecord();
  const key = currentKey();
  if (key) {
    // Re-inserted, so the oldest entries are the ones dropped.
    delete record.entries[key];
    if (tag) record.entries[key] = tag;
  }
  record.last = tag ? { ...tag, length: window.history.length } : null;
  const keys = Object.keys(record.entries);
  keys.slice(0, Math.max(0, keys.length - MAX_TAGGED_ENTRIES)).forEach((stale) => {
    delete record.entries[stale];
  });
  writeRecord(record);
}

/**
 * A full load gives the entry a new key, so its tag is lost. The tab's last
 * tag is reused only while the history length is unchanged: overcounting
 * would rewind past the set into other pages.
 */
export function readReloadedDepth(set: string | undefined) {
  const { last } = readRecord();
  return last && last.set === set && last.length === window.history.length
    ? last.depth
    : 0;
}
