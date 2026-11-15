/**
 * Run only against the local emulator: npm run test:sync-emulator. Checks, with the real SDK
 * and firestore.rules, what the incremental cloud sync of 作答紀錄 and 筆記 relies on.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  documentId,
  getCountFromServer,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import {
  deleteAndLogAttempts,
  deletionLogRef,
  parseDeletionLog,
  syncedAtMillis,
} from '../src/lib/cloud-sync-checkpoint';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('Local FIRESTORE_EMULATOR_HOST is required');
}
const projectId = 'demo-shane-sync';
const apps: FirebaseApp[] = [];

/** One signed-in browser: its own app, cache and connection. */
function browser(name: string, uid: string, port = 8089): Firestore {
  const app = initializeApp({ projectId, apiKey: 'demo-key' }, name);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', port, { mockUserToken: { user_id: uid } });
  return db;
}

let page: Firestore;
let otherDevice: Firestore;
let otherAccount: Firestore;

before(async () => {
  const cleared = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  assert.ok(cleared.ok, 'the emulator clears its data');
  page = browser('page', 'u1');
  otherDevice = browser('other-device', 'u1');
  otherAccount = browser('other-account', 'u2');
});
after(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});

const attempts = (db: Firestore) => collection(db, 'users', 'u1', 'attempts');
const notes = (db: Firestore) => collection(db, 'users', 'u1', 'notes');
const since = (target: ReturnType<typeof collection>, ms: number) =>
  query(target, where('syncedAt', '>=', Timestamp.fromMillis(ms)));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function attempt(id: string) {
  return {
    id,
    mode: 'practice',
    subject: 'law',
    year: null,
    questionIds: ['law-114-01'],
    answers: { 'law-114-01': 1 },
    startedAt: '2026-11-12T00:00:00.000Z',
    submittedAt: '2026-11-12T00:01:00.000Z',
    elapsedSeconds: 60,
    correctCount: 1,
    wrongCount: 0,
    unansweredCount: 0,
    syncedAt: serverTimestamp(),
  };
}

async function syncedAt(db: Firestore, kind: 'attempts' | 'notes', id: string) {
  const items = await getDocs(kind === 'attempts' ? attempts(db) : notes(db));
  const value = items.docs.find((item) => item.id === id)?.get('syncedAt');
  assert.ok(value instanceof Timestamp, `${id} has a server syncedAt`);
  return value;
}

/** Every change a listener reports, until `stop`. */
function watch(target: Query) {
  const changes: { type: string; id: string; pending: boolean; fromCache: boolean }[] =
    [];
  let synced = false;
  const stop = onSnapshot(target, { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.metadata.fromCache) synced = true;
    snapshot.docChanges().forEach((change) =>
      changes.push({
        type: change.type,
        id: change.doc.id,
        pending: change.doc.metadata.hasPendingWrites,
        fromCache: snapshot.metadata.fromCache,
      }),
    );
  });
  const until = async (done: () => boolean, label: string) => {
    for (let waited = 0; !done(); waited += 25) {
      if (waited > 10_000) throw new Error(`${label}: ${JSON.stringify(changes)}`);
      await wait(25);
    }
  };
  return { changes, stop, until, synced: () => synced };
}

test('a since-query from the rounded-down syncedAt returns that record and later ones only', async () => {
  for (const id of ['before', 'boundary', 'later']) {
    await setDoc(doc(attempts(otherDevice), id), attempt(id));
    await wait(20);
  }
  const boundary = await syncedAt(page, 'attempts', 'boundary');
  const floor = syncedAtMillis(boundary);
  assert.ok(floor !== null);
  const earlier = syncedAtMillis(await syncedAt(page, 'attempts', 'before'));
  assert.ok(
    earlier !== null && earlier < floor,
    'the earlier record is before the bound',
  );
  assert.ok(Timestamp.fromMillis(floor) <= boundary, 'rounding down keeps the record in');
  console.log(
    `boundary syncedAt ${boundary.seconds}s ${boundary.nanoseconds}ns, bound ${floor} ms`,
  );
  const result = await getDocs(since(attempts(page), floor));
  assert.equal(result.metadata.fromCache, false);
  assert.deepEqual(result.docs.map((item) => item.id).sort(), ['boundary', 'later']);
});

test('the account owner may count its attempts; another account may not', async () => {
  const count = await getCountFromServer(attempts(page));
  assert.equal(count.data().count, 3);
  await assert.rejects(getCountFromServer(attempts(otherAccount)), {
    code: 'permission-denied',
  });
  await assert.rejects(getDocs(since(attempts(otherAccount), 0)), {
    code: 'permission-denied',
  });
});

test('the owner may read chosen attempts by id, 30 to a query; another account may not', async () => {
  // How a page load reads again the records an older page could not read.
  const byIds = (db: Firestore, ids: string[]) =>
    getDocs(query(attempts(db), where(documentId(), 'in', ids)));
  const result = await byIds(page, ['before', 'later', 'never-written']);
  assert.equal(result.metadata.fromCache, false);
  assert.deepEqual(result.docs.map((item) => item.id).sort(), ['before', 'later']);
  const thirty = Array.from({ length: 30 }, (_, index) => `missing-${index}`);
  assert.equal((await byIds(page, thirty)).size, 0);
  // The SDK no longer checks the size; the server refuses a 31st value.
  await assert.rejects(byIds(page, [...thirty, 'one-more']), {
    code: 'invalid-argument',
  });
  await assert.rejects(byIds(otherAccount, ['before']), { code: 'permission-denied' });
});

test('a since-query listener reports a record deleted on another device as removed', async () => {
  await setDoc(doc(attempts(otherDevice), 'to-delete'), attempt('to-delete'));
  const floor = syncedAtMillis(await syncedAt(page, 'attempts', 'to-delete'));
  assert.ok(floor !== null);
  const listener = watch(since(attempts(page), floor));
  try {
    await listener.until(
      () =>
        listener.synced() && listener.changes.some((change) => change.id === 'to-delete'),
      'the record is in the window',
    );
    await deleteDoc(doc(attempts(otherDevice), 'to-delete'));
    await listener.until(
      () =>
        listener.changes.some(
          (change) =>
            change.type === 'removed' && change.id === 'to-delete' && !change.fromCache,
        ),
      'the deletion is reported',
    );
    console.log(`listener changes: ${JSON.stringify(listener.changes)}`);
  } finally {
    listener.stop();
  }
});

test("this page's own pending write leaves its since-query, then comes back accepted", async () => {
  // Why the notes listener ignores 'removed', and an accepted attempt is never written again.
  const note = (content: string) => ({
    questionId: 'law-114-01',
    content,
    updatedAt: new Date().toISOString(),
    syncedAt: serverTimestamp(),
  });
  await setDoc(doc(notes(otherDevice), 'law-114-01'), note('另一台'));
  const floor = syncedAtMillis(await syncedAt(page, 'notes', 'law-114-01'));
  assert.ok(floor !== null);
  const listener = watch(since(notes(page), floor));
  try {
    await listener.until(
      () => listener.synced() && listener.changes.length > 0,
      'the note is in the window',
    );
    const seen = listener.changes.length;
    await setDoc(doc(notes(page), 'law-114-01'), note('這一台'));
    await listener.until(
      () =>
        listener.changes
          .slice(seen)
          .some((change) => change.type === 'added' && !change.pending),
      'the accepted note comes back',
    );
    const own = listener.changes.slice(seen);
    console.log(`own write changes: ${JSON.stringify(own)}`);
    assert.deepEqual(
      own.map((change) => change.type),
      ['removed', 'added'],
    );
    assert.equal(
      own[0].pending,
      false,
      "the removal does not say it is this page's write",
    );
  } finally {
    listener.stop();
  }
});

const refused = { code: 'permission-denied' };
const ids = (count: number, prefix = 'id') =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

test('the owner deletes attempts and logs them in one transaction', async () => {
  for (const id of ['log-a', 'log-b', 'log-c']) {
    await setDoc(doc(attempts(otherDevice), id), attempt(id));
  }
  await deleteAndLogAttempts(page, 'u1', ['log-a']);
  // Another device adds to the same log.
  await deleteAndLogAttempts(otherDevice, 'u1', ['log-b', 'log-c']);
  const log = await getDocFromServer(deletionLogRef(page, 'u1'));
  assert.deepEqual(parseDeletionLog(log.data()), ['log-a', 'log-b', 'log-c']);
  assert.ok(log.get('syncedAt') instanceof Timestamp, 'the log has a server syncedAt');
  const left = await getDocs(
    query(attempts(page), where(documentId(), 'in', ['log-a', 'log-b', 'log-c'])),
  );
  assert.equal(left.size, 0, 'the attempts are gone');
  // Logged again, one moves to the end, once.
  await deleteAndLogAttempts(page, 'u1', ['log-a']);
  assert.deepEqual(
    parseDeletionLog((await getDocFromServer(deletionLogRef(page, 'u1'))).data()),
    ['log-b', 'log-c', 'log-a'],
  );
});

test("another device's log listener hears each deletion from the server", async () => {
  const heard: string[][] = [];
  const stop = onSnapshot(
    deletionLogRef(page, 'u1'),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache) heard.push(parseDeletionLog(snapshot.data()));
    },
  );
  try {
    for (let waited = 0; !heard.length; waited += 25) {
      if (waited > 10_000) throw new Error('the log listener never answered');
      await wait(25);
    }
    await setDoc(doc(attempts(otherDevice), 'log-d'), attempt('log-d'));
    await deleteAndLogAttempts(otherDevice, 'u1', ['log-d']);
    for (let waited = 0; !heard.at(-1)?.includes('log-d'); waited += 25) {
      if (waited > 10_000)
        throw new Error(`log-d never arrived: ${JSON.stringify(heard)}`);
      await wait(25);
    }
    console.log(`log listener answers: ${heard.length}`);
  } finally {
    stop();
  }
});

test('another account may neither read nor write the log', async () => {
  const log = deletionLogRef(otherAccount, 'u1');
  await assert.rejects(getDocFromServer(log), refused);
  await assert.rejects(
    setDoc(log, { attemptIds: ['log-x'], syncedAt: serverTimestamp() }),
    refused,
  );
  await assert.rejects(deleteAndLogAttempts(otherAccount, 'u1', ['log-x']), refused);
  await assert.rejects(deleteDoc(log), refused);
});

test('the rules refuse a log with other keys, more than 1000 ids or a time the client chose', async () => {
  const log = deletionLogRef(page, 'u1');
  await assert.rejects(
    setDoc(log, { attemptIds: [], syncedAt: serverTimestamp(), note: 'extra' }),
    refused,
  );
  await assert.rejects(
    setDoc(log, { attemptIds: 'log-a', syncedAt: serverTimestamp() }),
    refused,
  );
  await assert.rejects(setDoc(log, { syncedAt: serverTimestamp() }), refused);
  await assert.rejects(
    setDoc(log, { attemptIds: ids(1001), syncedAt: serverTimestamp() }),
    refused,
  );
  await assert.rejects(
    setDoc(log, { attemptIds: [], syncedAt: Timestamp.now() }),
    refused,
  );
  await assert.rejects(setDoc(log, { attemptIds: [] }), refused);
  await assert.rejects(deleteDoc(log), refused);
  // 1000 is allowed, and a deletion added to a full log keeps it at 1000.
  await setDoc(log, { attemptIds: ids(1000), syncedAt: serverTimestamp() });
  await deleteAndLogAttempts(page, 'u1', ['log-z']);
  const full = parseDeletionLog((await getDocFromServer(log)).data());
  assert.equal(full.length, 1000);
  assert.equal(full[0], 'id-1');
  assert.equal(full.at(-1), 'log-z');
  assert.ok((await getDocFromServer(log)).exists(), 'the log is still there');
});

test('a deletion transaction that cannot reach the server fails as unavailable', async () => {
  // Nothing listens on this port. The app keeps the deletion pending on this code.
  const unreachable = browser('unreachable', 'u1', 1);
  const started = Date.now();
  await assert.rejects(deleteAndLogAttempts(unreachable, 'u1', ['log-offline']), {
    code: 'unavailable',
  });
  console.log(`offline transaction gave up after ${Date.now() - started} ms`);
});
