import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectProgressSync, trackLocalProgress, type ProgressTransport } from './progress-sync-client';
import { applyProgressRecord, captureProgress, compareProgress, parseProgressRecord, PROGRESS_JOURNAL_KEY, PROGRESS_OWNER_KEY, readLocalProgress, readProgressJournal, type ProgressRecord } from './progress-sync';
import { notifyProgressChanged } from './progress-events';
import { PRACTICE_SESSION_STORAGE_KEY, type PracticeSession } from '@/features/practice/practice-session';
import { QUIZ_PROGRESS_STORAGE_KEY } from '@/features/practice/mock-exam-progress';
import { summarizeMockExamDraft } from '@/features/practice/mock-exam';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.useRealTimers(); });
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(),
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); }, key: index => [...values.keys()][index] ?? null };
}
function practice(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return { version: 1, id: 'daily-1', subject: 'law', rangeStart: 113, rangeEnd: 114, category: 'all',
    questionIds: ['law-114-01', 'law-114-02'], optionOrders: { 'law-114-01': [2, 0, 3, 1] },
    drafts: { 'law-114-02': 1 }, answers: { 'law-114-01': { selected: 2, correct: true } },
    eliminated: { 'law-114-02': [3] }, elapsedSeconds: { 'law-114-01': 42 }, currentIndex: 1, ...overrides };
}
const record = (payload: string | null, updatedAt = 100, writer = 'desktop'): ProgressRecord => ({ version: 1, payload, updatedAt, writer });
function server(initial: Record<string, ProgressRecord> = {}) {
  const records = { ...initial };
  const listeners = new Set<(records: Record<string, unknown>) => void>();
  const transport: ProgressTransport = {
    listen(receive) { listeners.add(receive); receive({ ...records }); return () => { listeners.delete(receive); }; },
    async write(id, next) {
      if (!records[id] || compareProgress(next, records[id]) > 0) records[id] = next;
      listeners.forEach(receive => receive({ ...records }));
      return records[id];
    },
  };
  return { records, transport };
}
function mount(storage: Storage, transport: ProgressTransport, uid = 'user', report = vi.fn()) {
  const stopTracking = trackLocalProgress(storage, 'device');
  const stopSync = connectProgressSync(storage, uid, transport, report);
  const stop = () => { stopSync(); stopTracking(); };
  cleanups.push(stop);
  return stop;
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('cross-device unfinished practice', () => {
  it('hands daily questions, shuffled options, answer, elimination, time and position to a new device', async () => {
    const cloud = server();
    const desktop = memoryStorage();
    desktop.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(practice()));
    const leave = mount(desktop, cloud.transport);
    await settle();
    leave();
    const phone = memoryStorage();
    mount(phone, cloud.transport);
    await settle();
    expect(JSON.parse(phone.getItem(PRACTICE_SESSION_STORAGE_KEY)!)).toEqual(practice());
    expect(JSON.parse(cloud.records.practice.payload!)).toEqual(practice());
  });

  it('returns edits from the second device and cannot resurrect a completed draft from a stale device', async () => {
    vi.useFakeTimers();
    const cloud = server({ practice: record(JSON.stringify(practice())) });
    const phone = memoryStorage();
    const stop = mount(phone, cloud.transport);
    await settle();
    phone.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(practice({ currentIndex: 0 })));
    notifyProgressChanged(PRACTICE_SESSION_STORAGE_KEY);
    await vi.advanceTimersByTimeAsync(350);
    expect(JSON.parse(cloud.records.practice.payload!).currentIndex).toBe(0);
    phone.removeItem(PRACTICE_SESSION_STORAGE_KEY);
    notifyProgressChanged(PRACTICE_SESSION_STORAGE_KEY);
    await vi.advanceTimersByTimeAsync(350);
    expect(cloud.records.practice.payload).toBeNull();
    stop();
    const stale = memoryStorage();
    stale.setItem(PROGRESS_OWNER_KEY, 'user');
    stale.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(practice()));
    stale.setItem(PROGRESS_JOURNAL_KEY + 'user', JSON.stringify({ practice: record(JSON.stringify(practice())) }));
    mount(stale, cloud.transport);
    await settle();
    expect(stale.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBeNull();
    expect(cloud.records.practice.payload).toBeNull();
  });

  it('syncs each mock paper independently and resumes the last opened question', async () => {
    const draft = { 'law-114-01': { elapsedSeconds: 18, startedAt: '2026-11-07', selected: 1, visitedAt: 200 },
      'law-114-02': { elapsedSeconds: 8, startedAt: '2026-11-07', eliminatedOptions: [2], visitedAt: 100 } };
    const cloud = server({ 'paper-law-114': record(JSON.stringify(draft)) });
    const phone = memoryStorage();
    phone.setItem(QUIZ_PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, scopes: { 'paper:env:114': { 'env-114-01': draft['law-114-01'] } } }));
    mount(phone, cloud.transport);
    await settle();
    const scopes = JSON.parse(phone.getItem(QUIZ_PROGRESS_STORAGE_KEY)!).scopes;
    expect(scopes['paper:law:114']).toEqual(draft);
    expect(scopes['paper:env:114']).toBeDefined();
    expect(summarizeMockExamDraft(scopes['paper:law:114'], Object.keys(draft)).resumeIndex).toBe(0);
    expect(cloud.records['paper-env-114']).toBeDefined();
  });

  it('keeps another account’s local work out of a newly signed-in account', async () => {
    const storage = memoryStorage();
    storage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(practice()));
    const firstCloud = server();
    const stop = mount(storage, firstCloud.transport, 'first');
    await settle();
    stop();
    const otherCloud = server();
    const stopOther = mount(storage, otherCloud.transport, 'second');
    await settle();
    expect(storage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBeNull();
    expect(otherCloud.records).toEqual({});
    stopOther();
    mount(storage, firstCloud.transport, 'first');
    await settle();
    expect(JSON.parse(storage.getItem(PRACTICE_SESSION_STORAGE_KEY)!)).toEqual(practice());
  });

  it('does not overwrite a newer server version that arrives during upload', async () => {
    const storage = memoryStorage();
    const old = record(JSON.stringify(practice()), 10);
    const newer = record(JSON.stringify(practice({ currentIndex: 0 })), 20, 'phone');
    storage.setItem(PROGRESS_OWNER_KEY, 'user');
    storage.setItem(PRACTICE_SESSION_STORAGE_KEY, old.payload!);
    storage.setItem(PROGRESS_JOURNAL_KEY + 'user', JSON.stringify({ practice: old }));
    const transport: ProgressTransport = { listen(receive) { receive({}); return () => {}; }, write: vi.fn(async () => newer) };
    mount(storage, transport);
    await settle();
    expect(JSON.parse(storage.getItem(PRACTICE_SESSION_STORAGE_KEY)!).currentIndex).toBe(0);
    expect(readProgressJournal(storage, 'user').practice).toEqual(parseProgressRecord('practice', newer));
  });

  it('keeps local progress after a denied write and retries on focus', async () => {
    const storage = memoryStorage();
    storage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(practice()));
    const cloud = server();
    const write = vi.fn(cloud.transport.write).mockRejectedValueOnce(new Error('permission-denied'));
    const report = vi.fn();
    mount(storage, { ...cloud.transport, write }, 'user', report);
    await settle();
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(storage.getItem(PRACTICE_SESSION_STORAGE_KEY)).not.toBeNull();
    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(cloud.records.practice.payload).not.toBeNull();
    expect(report).toHaveBeenLastCalledWith({ status: 'synced', error: '' });
  });

  it('uses deterministic tie breaking and durable tombstones for resets', () => {
    expect(compareProgress(record(null, 5, 'b'), record(null, 5, 'a'))).toBeGreaterThan(0);
    expect(captureProgress({ practice: record('old', 100) }, {}, 'phone', 50).practice).toEqual(record(null, 101, 'phone'));
    expect(parseProgressRecord('invalid', record(null))).toBeNull();
    expect(parseProgressRecord('practice', record('garbage'))).toBeNull();
    const storage = memoryStorage();
    applyProgressRecord(storage, 'practice', record(JSON.stringify(practice({ drafts: {}, answers: {}, eliminated: {}, elapsedSeconds: {}, currentIndex: 0 }))));
    expect(readLocalProgress(storage)).toEqual({});
  });

  it('does not connect or overwrite local work if its journal could not be saved', () => {
    const storage = memoryStorage();
    storage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(practice()));
    const cloud = server({ practice: record(null, 1000) });
    const listen = vi.fn(cloud.transport.listen);
    expect(() => connectProgressSync(storage, 'user', { ...cloud.transport, listen }, vi.fn())).toThrow('journal');
    expect(listen).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getItem(PRACTICE_SESSION_STORAGE_KEY)!)).toEqual(practice());
  });

  it('rolls an unsuccessful account switch back without associating old drafts with the new account', () => {
    const storage = memoryStorage();
    storage.setItem(PROGRESS_OWNER_KEY, 'first');
    storage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(practice()));
    cleanups.push(trackLocalProgress(storage, 'desktop'));
    const set = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === PROGRESS_OWNER_KEY && value === 'second') throw new Error('quota');
      set(key, value);
    });
    expect(() => connectProgressSync(storage, 'second', server().transport, vi.fn())).toThrow('quota');
    expect(storage.getItem(PROGRESS_OWNER_KEY)).toBe('first');
    expect(JSON.parse(storage.getItem(PRACTICE_SESSION_STORAGE_KEY)!)).toEqual(practice());
    expect(storage.getItem(PROGRESS_JOURNAL_KEY + 'second')).toBeNull();
  });
});
