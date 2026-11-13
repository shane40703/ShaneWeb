/** Run only against the local emulator: npm run test:push-rules. Never uses application credentials. */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where, writeBatch, type Firestore } from 'firebase/firestore';
import { firestorePushTransport } from '../src/lib/push-messages-firestore';
import type { PushReceipt } from '../src/lib/push-messages';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Local FIRESTORE_EMULATOR_HOST is required');
const browserId = '12345678-1234-1234-1234-123456789abc';
let env: RulesTestEnvironment;
let db: Firestore;
let receipt: PushReceipt;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-shane-push', firestore: {
    host: host.split(':')[0], port: Number(host.split(':')[1]), rules: await readFile('firestore.rules', 'utf8'),
  } });
  db = env.unauthenticatedContext().firestore() as unknown as Firestore;
});
beforeEach(async () => {
  await env.clearFirestore();
  receipt = { id: 'announcement', status: 'test', message: '', expiresAt: Date.now() + 60_000, read: false, pending: true };
  await author({ message: '測試文字', status: 'test', expiresAt: Timestamp.fromMillis(receipt.expiresAt) });
});
after(async () => { await env?.cleanup(); });
async function author(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, 'pushMessages', receipt.id), data, { merge: true });
  });
}
const parent = () => doc(db, 'pushMessages', receipt.id);
const child = (status = receipt.status) => doc(parent(), 'receipts', `${status}_${browserId}`);
const stats = (status = receipt.status) => doc(parent(), 'stats', status);

test('normal query sees only live; preview query accepts test and live; invalid status is unreadable', async () => {
  const messages = collection(db, 'pushMessages');
  assert.equal((await assertSucceeds(getDocs(query(messages, where('status', '==', 'live'))))).size, 0);
  assert.equal((await assertSucceeds(getDocs(query(messages, where('status', 'in', ['test', 'live']))))).size, 1);
  await assertFails(getDocs(messages));
  await author({ status: 'draft' });
  await assertFails(getDoc(parent()));
});
test('public visitors cannot create, edit, remove announcements or arbitrarily change counters', async () => {
  await assertFails(setDoc(doc(db, 'pushMessages', 'injected'), { status: 'live', message: 'injected' }));
  await assertFails(updateDoc(parent(), { message: 'injected' }));
  await assertFails(updateDoc(parent(), { status: 'live' }));
  await assertFails(updateDoc(parent(), { testDelivered: 100, lastReceiptId: `test_${browserId}` }));
  await assertFails(setDoc(stats(), { delivered: 100, read: 0, lastReceiptId: `test_${browserId}` }));
  await assertFails(getDocs(collection(parent(), 'stats')));
  await assertFails(deleteDoc(parent()));
});
test('delivery and read are idempotent under parallel transactions, without logging in', async () => {
  const transport = firestorePushTransport(db);
  // Also exercise the delivery-only path before racing two fresh receipt creations.
  await transport.record(receipt, '00000000-0000-0000-0000-000000000000');
  const results = await Promise.all([transport.record(receipt, browserId), transport.record(receipt, browserId)]);
  assert.equal(results.filter((value) => value.delivered).length, 1);
  await Promise.all([transport.record({ ...receipt, read: true }, browserId), transport.record({ ...receipt, read: true }, browserId)]);
  const data = (await getDoc(stats())).data()!;
  assert.equal(data.delivered, 2);
  assert.equal(data.read, 1);
  assert.equal((await getDoc(parent())).data()!.testDelivered, undefined);
  await assertFails(getDocs(collection(parent(), 'receipts')));
  await assertFails(deleteDoc(child()));
  await assertFails(updateDoc(child(), { read: false }));
});
test('promotion to live has independent receipts and counters', async () => {
  const transport = firestorePushTransport(db);
  await transport.record({ ...receipt, read: true }, browserId);
  await author({ status: 'live' });
  await transport.record({ ...receipt, status: 'live', read: true }, browserId);
  const testStats = (await getDoc(stats('test'))).data()!;
  const liveStats = (await getDoc(stats('live'))).data()!;
  assert.deepEqual([testStats.delivered, testStats.read, liveStats.delivered, liveStats.read], [1, 1, 1, 1]);
});
test('legacy clients and existing parent counts remain compatible and separate', async () => {
  await author({ testDelivered: 7, testRead: 5 });
  const oldId = `test_${'00000000-0000-0000-0000-000000000000'}`;
  const batch = writeBatch(db);
  batch.set(doc(parent(), 'receipts', oldId), { status: 'test', delivered: true, read: false });
  batch.update(parent(), { testDelivered: 8, testRead: 5, lastReceiptId: oldId });
  await assertSucceeds(batch.commit());
  await firestorePushTransport(db).record({ ...receipt, read: true }, browserId);
  assert.deepEqual([(await getDoc(parent())).data()!.testDelivered, (await getDoc(parent())).data()!.testRead], [8, 5]);
  assert.deepEqual([(await getDoc(stats())).data()!.delivered, (await getDoc(stats())).data()!.read], [1, 1]);
});
test('receipt writes must atomically accompany exactly one matching counter increment', async () => {
  await assertFails(setDoc(child(), { status: 'test', delivered: true, read: false }));
  const batch = writeBatch(db);
  batch.set(child(), { status: 'test', delivered: true, read: false });
  batch.update(parent(), { testDelivered: 999, testRead: 0, lastReceiptId: `test_${browserId}` });
  await assertFails(batch.commit());
  const mixed = writeBatch(db);
  mixed.set(child(), { status: 'test', delivered: true, read: true });
  mixed.update(parent(), { testDelivered: 1, testRead: 1, lastReceiptId: `test_${browserId}` });
  mixed.set(stats(), { delivered: 1, read: 1, lastReceiptId: `test_${browserId}` });
  await assertFails(mixed.commit());
  const forged = writeBatch(db);
  forged.set(child(), { status: 'test', delivered: true, read: false });
  forged.set(stats(), { delivered: 999, read: 0, lastReceiptId: `test_${browserId}` });
  await assertFails(forged.commit());
});
test('cannot count expired announcements, replay read, or use a receipt from another document', async () => {
  const transport = firestorePushTransport(db);
  await transport.record({ ...receipt, read: true }, browserId);
  await assertFails(updateDoc(parent(), { testRead: 2 }));
  await author({ expiresAt: Timestamp.fromMillis(Date.now() - 1) });
  const batch = writeBatch(db);
  const otherId = `test_${'a'.repeat(36)}`;
  batch.set(doc(parent(), 'receipts', otherId), { status: 'test', delivered: true, read: false });
  batch.update(parent(), { testDelivered: 2, lastReceiptId: otherId });
  await assertFails(batch.commit());
});
test('existing private per-user paths still reject unauthenticated visitors', async () => {
  await assertFails(getDoc(doc(db, 'users', 'owner', 'progress', 'practice')));
  await assertFails(setDoc(doc(db, 'users', 'owner', 'notes', 'question'), { content: 'injected' }));
});
