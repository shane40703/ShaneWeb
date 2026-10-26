import { useRouter } from 'next/router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { isSubjectId, parseYear } from '@/lib/study';
import type { SubjectId } from '@/lib/types';
import { useClientReady } from '@/lib/use-client-ready';
import { useAppState } from '@/state/app-state';
import { PracticeQuiz, type PracticeQuestionStatus } from './practice-quiz';
import { PracticeResultView } from './practice-result';
import {
  addPracticeTime,
  confirmPracticeAnswer,
  createPracticeAttempts,
  createPracticePaper,
  createPracticeResult,
  createPracticeSession,
  createPracticeTimer,
  DEFAULT_PRACTICE_SETTINGS,
  displayPracticeQuestion,
  hasPracticeAnswers,
  hasPracticeProgress,
  movePracticeTo,
  parsePracticeSession,
  PRACTICE_PATH,
  PRACTICE_SESSION_STORAGE_KEY,
  resetPracticeAnswers,
  resolvePracticePool,
  selectPracticeOption,
  summarizePractice,
  togglePracticeElimination,
  type PracticeResult,
  type PracticeSession,
  type PracticeSettings,
} from './practice-session';
import { readEntryTag, readReloadedDepth, writeEntryTag } from './practice-history';
import { keepPracticeResult, readKeptPracticeResult } from './practice-result-memory';
import { PracticeSetup } from './practice-setup';
import styles from './practice-page.module.css';

type Query = Record<string, number | string>;
type SessionChange =
  PracticeSession | null | ((current: PracticeSession | null) => PracticeSession | null);

// A rewind that lands nowhere (shorter history than counted) must not hijack a later Back.
const REWIND_TIMEOUT_MS = 1000;

function removeStoredSession() {
  try {
    window.localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
  } catch {
    // The in-memory reset still works when private browsing blocks storage.
  }
}

/** `?q=` is 1-based; anything outside the set is treated as missing. */
function parseQuestionNumber(value: string | string[] | undefined, total: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const number = Number(raw);
  return number >= 1 && number <= total ? number - 1 : null;
}

function scrollToTop() {
  // 'instant' overrides the global smooth scrolling for a whole-page jump.
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * Views change under the pointer, so the second click of a double-click would
 * act on whatever appears there. Keyboard activation reports detail 0.
 */
function ignoreRepeatClick(event: MouseEvent) {
  if (event.detail <= 1) return;
  // A second click on the selected answer deliberately clears it, not a navigation.
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('label')?.querySelector('[role="radio"][aria-checked="true"]')) return;
  event.preventDefault();
  event.stopPropagation();
}

export function PracticePage() {
  const router = useRouter();
  const ready = useClientReady();
  const { dispatch, reportPersistence } = useAppState();
  const [restored, setRestored] = useState(false);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [result, setResult] = useState<PracticeResult | null>(null);
  // The result stays in memory through Back/Forward; only a reload drops it.
  const [resultShown, setResultShown] = useState(false);
  const [subject, setSubject] = useState<SubjectId>('law');
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_PRACTICE_SETTINGS);
  const [timer] = useState(createPracticeTimer);
  // Mirrors `session` synchronously, so handlers and listeners never act on a stale copy.
  const sessionRef = useRef<PracticeSession | null>(null);
  const lastWritten = useRef<string | null>(null);
  const syncedPath = useRef<string | null>(null);
  const depth = useRef(0);
  const ownNavigations = useRef(0);
  // Nothing loads before the stored set says which subject is needed.
  const bank = useSubjectQuestions(restored ? [session?.subject ?? subject] : []);
  const questionById = useMemo(
    () => new Map(bank.questions.map((question) => [question.id, question])),
    [bank.questions],
  );
  const pool = useMemo(
    () => resolvePracticePool(bank.questions, subject, settings),
    [bank.questions, subject, settings],
  );

  const commitSession = useCallback((change: SessionChange) => {
    const next = typeof change === 'function' ? change(sessionRef.current) : change;
    if (next === sessionRef.current) return;
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Routes within the page and tags the entry once it is current. */
  const routeTo = useCallback(
    (method: 'push' | 'replace', query: Query | undefined, entryDepth: number) => {
      ownNavigations.current += 1;
      return Promise.resolve(
        router[method](
          query ? { pathname: PRACTICE_PATH, query } : PRACTICE_PATH,
          undefined,
          {
            shallow: true,
            scroll: false,
          },
        ),
      )
        .catch(() => false)
        .finally(() => {
          ownNavigations.current -= 1;
          depth.current = entryDepth;
          const current = sessionRef.current;
          writeEntryTag(current ? { set: current.id, depth: entryDepth } : null);
        });
    },
    [router],
  );

  /**
   * Leaves the current set's history: this entry becomes `query`, then Back
   * jumps to the set's first entry, which the URL sync turns into the current
   * view. Back from there leaves the page instead of visiting old questions.
   */
  const leaveSetHistory = useCallback(
    (query: Query | undefined) => {
      const back = depth.current;
      // Claimed at once: a second change arriving mid-rewind must not rewind again.
      depth.current = 0;
      void routeTo('replace', query, 0).then(() => {
        if (back <= 0) return;
        let timeout = 0;
        function landed() {
          window.clearTimeout(timeout);
          // The set's first entry shows whatever is current by now, which a
          // later change from another tab may have replaced.
          const current = sessionRef.current;
          void routeTo(
            'replace',
            current ? { q: current.currentIndex + 1 } : undefined,
            0,
          );
        }
        window.addEventListener('popstate', landed, { once: true });
        timeout = window.setTimeout(
          () => window.removeEventListener('popstate', landed),
          REWIND_TIMEOUT_MS,
        );
        window.history.go(-back);
      });
    },
    [routeTo],
  );

  useEffect(() => {
    if (!ready || restored) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const stored = parsePracticeSession(readStoredValue(PRACTICE_SESSION_STORAGE_KEY));
      if (stored) {
        commitSession(stored);
        setSubject(stored.subject);
        // Back from the hub: the result submitted before leaving is still there.
        setResult(readKeptPracticeResult(stored));
      }
      setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [commitSession, ready, restored]);

  // The result outlives this page until a reload, so Back can return to it.
  useEffect(() => {
    if (restored) keepPracticeResult(result);
  }, [restored, result]);

  // Writes only when the set itself changed: not on clock ticks, and never
  // echoing back a copy that was just adopted from another tab.
  useEffect(() => {
    if (!restored) return;
    const json = session ? JSON.stringify(session) : null;
    if (json === lastWritten.current) return;
    lastWritten.current = json;
    if (json) {
      reportPersistence(
        'practice-session',
        writeStoredValue(PRACTICE_SESSION_STORAGE_KEY, json),
      );
    } else {
      removeStoredSession();
    }
  }, [reportPersistence, restored, session]);

  // Only one set exists at a time: another tab's write replaces this tab's copy.
  useEffect(() => {
    if (!restored) return;
    function adopt(event: StorageEvent) {
      if (event.key !== null && event.key !== PRACTICE_SESSION_STORAGE_KEY) return;
      const raw = event.key === null ? null : event.newValue;
      const incoming = parsePracticeSession(raw);
      const current = sessionRef.current;
      if (!incoming) {
        if (!current) return;
        timer.take();
        lastWritten.current = null;
        commitSession(null);
        setResult(null);
        setResultShown(false);
        leaveSetHistory(undefined);
        return;
      }
      if (current?.id === incoming.id) {
        // Same set: take its answers, keep this tab on its own question.
        const merged = { ...incoming, currentIndex: current.currentIndex };
        const pending = timer.peek();
        if (pending) {
          // Two visible windows on one question count its time once.
          timer.discount(
            pending.questionId,
            (incoming.elapsedSeconds[pending.questionId] ?? 0) -
              (current.elapsedSeconds[pending.questionId] ?? 0),
          );
        }
        lastWritten.current = JSON.stringify(merged);
        commitSession(merged);
        if (result && hasPracticeAnswers(incoming)) {
          // Answered again elsewhere: the old result's 重做 must not wipe that.
          setResult(null);
          setResultShown(false);
          if (router.query.view === 'result') {
            void routeTo('replace', { q: merged.currentIndex + 1 }, depth.current);
          }
        }
        return;
      }
      timer.take();
      lastWritten.current = JSON.stringify(incoming);
      commitSession(incoming);
      setSubject(incoming.subject);
      setResult(null);
      setResultShown(false);
      leaveSetHistory({ q: incoming.currentIndex + 1 });
    }
    window.addEventListener('storage', adopt);
    return () => window.removeEventListener('storage', adopt);
  }, [
    commitSession,
    leaveSetHistory,
    restored,
    result,
    routeTo,
    router.query.view,
    timer,
  ]);

  // Saves the running clock when the page is hidden, closed or left, so a
  // reload keeps the time without saving every second.
  useEffect(() => {
    if (!restored) return;
    function saveClock() {
      const pending = timer.take();
      const current = sessionRef.current;
      if (!pending || !current) return;
      const next = addPracticeTime(current, pending);
      if (next === current) return;
      const json = JSON.stringify(next);
      lastWritten.current = json;
      reportPersistence(
        'practice-session',
        writeStoredValue(PRACTICE_SESSION_STORAGE_KEY, json),
      );
      commitSession(next);
    }
    function saveWhenHidden() {
      if (document.visibilityState === 'hidden') saveClock();
    }
    window.addEventListener('pagehide', saveClock);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      window.removeEventListener('pagehide', saveClock);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      saveClock();
    };
  }, [commitSession, reportPersistence, restored, timer]);

  // The URL follows the buttons, and the state follows the URL whenever it
  // changes on its own: navigator links, Back/Forward, or a load. Reacting
  // only to a changed path keeps a just-submitted result from being hidden
  // before its own URL arrives.
  useEffect(() => {
    if (!restored || !router.isReady || syncedPath.current === router.asPath) return;
    const firstVisit = syncedPath.current === null;
    syncedPath.current = router.asPath;
    // Our own route changes already match the state; routeTo tags them.
    if (ownNavigations.current > 0) return;
    const current = sessionRef.current;
    const { q, view, subject: chosen, category, from, to } = router.query;
    if (!current) {
      // No set, nothing to rewind. Never count here: an own replace whose
      // promise settled before this effect ran also arrives untagged.
      depth.current = 0;
      // A link can open the setup with a subject chosen; 考題分析's also brings its
      // year range and category.
      const setupLink = [category, from, to].some((value) => value !== undefined);
      if (isSubjectId(chosen) || setupLink) {
        void Promise.resolve().then(() => {
          if (isSubjectId(chosen)) setSubject(chosen);
          if (!setupLink) return;
          setSettings((latest) => ({
            ...latest,
            category: typeof category === 'string' && category ? category : 'all',
            fromYear: parseYear(from) ?? undefined,
            toYear: parseYear(to) ?? undefined,
          }));
        });
      }
      if (q !== undefined || view !== undefined || chosen !== undefined || setupLink) {
        void routeTo('replace', undefined, 0);
      } else {
        writeEntryTag(null);
      }
      return;
    }
    const tag = readEntryTag();
    const stale = Boolean(tag && tag.set !== current.id);
    // Back/Forward land on tagged entries; a navigator link adds an untagged one.
    let entryDepth: number;
    if (tag && !stale) entryDepth = tag.depth;
    else if (firstVisit) entryDepth = tag ? 0 : readReloadedDepth(current.id);
    else entryDepth = depth.current + 1;
    depth.current = entryDepth;

    if (stale) {
      // An entry of a set that is gone: show this set, never reread its question.
      void routeTo('replace', { q: current.currentIndex + 1 }, entryDepth);
      return;
    }
    if (view === 'result') {
      // Results live only in memory, so a reload lands on the blank set, from
      // its first question unless it has already been answered again.
      if (!result) {
        void routeTo(
          'replace',
          { q: (hasPracticeAnswers(current) ? current.currentIndex : 0) + 1 },
          entryDepth,
        );
        return;
      }
      writeEntryTag({ set: current.id, depth: entryDepth });
      void Promise.resolve().then(() => setResultShown(true));
      return;
    }
    const index = parseQuestionNumber(q, current.questionIds.length);
    if (index === null) {
      void routeTo('replace', { q: current.currentIndex + 1 }, entryDepth);
    } else {
      writeEntryTag({ set: current.id, depth: entryDepth });
    }
    void Promise.resolve().then(() => {
      setResultShown(false);
      if (index === null || index === sessionRef.current?.currentIndex) return;
      const pending = timer.take();
      commitSession(
        (latest) => latest && movePracticeTo(addPracticeTime(latest, pending), index),
      );
    });
  }, [
    commitSession,
    restored,
    result,
    routeTo,
    router.asPath,
    router.isReady,
    router.query,
    timer,
  ]);

  const currentId = session?.questionIds[session.currentIndex];
  const sourceQuestion = currentId ? questionById.get(currentId) : undefined;
  const currentOrder = currentId ? session?.optionOrders[currentId] : undefined;
  const currentQuestion = useMemo(
    () =>
      sourceQuestion ? displayPracticeQuestion(sourceQuestion, currentOrder) : undefined,
    [sourceQuestion, currentOrder],
  );
  const currentAnswered = Boolean(currentId && session?.answers[currentId]);
  const view = !restored
    ? 'loading'
    : !session
      ? 'setup'
      : result && resultShown
        ? 'result'
        : 'question';
  const timing = view === 'question' && Boolean(currentQuestion) && !currentAnswered;

  useEffect(() => {
    if (!timing || !currentId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') timer.tick(currentId);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [currentId, timer, timing]);

  function navigate(
    method: 'push' | 'replace',
    query: Query | undefined,
    entryDepth: number,
  ) {
    void routeTo(method, query, entryDepth);
    scrollToTop();
  }

  function clearResult() {
    setResult(null);
    setResultShown(false);
  }

  /** Answers, selections or strike-outs would be lost: ask first. */
  function confirmDiscard(
    message = '確定要放棄目前的題組並回到設定嗎？作答進度會清除。',
  ) {
    const current = sessionRef.current;
    return (
      !current ||
      !(hasPracticeProgress(current) || timer.getSeconds() > 0) ||
      window.confirm(message)
    );
  }

  function changeSubject(next: SubjectId) {
    setSubject(next);
    // Years and categories differ per subject; the count and options carry over.
    setSettings((current) => ({
      ...current,
      fromYear: undefined,
      toYear: undefined,
      category: 'all',
    }));
  }

  function startPractice() {
    if (!pool.count) return;
    timer.take();
    clearResult();
    commitSession(createPracticeSession(pool, subject, settings.shuffleOptions));
    // The setup entry becomes the set's first: Back from question 1 leaves the page.
    navigate('replace', { q: 1 }, 0);
  }

  function makePaper() {
    // A separate draw: the paper never becomes the online set.
    const draw = createPracticeSession(pool, subject, settings.shuffleOptions);
    return createPracticePaper(draw, questionById);
  }

  function goTo(index: number) {
    const current = sessionRef.current;
    if (!current) return;
    const next = Math.max(0, Math.min(index, current.questionIds.length - 1));
    if (next === current.currentIndex) return;
    const pending = timer.take();
    commitSession(
      (latest) => latest && movePracticeTo(addPracticeTime(latest, pending), next),
    );
    navigate('push', { q: next + 1 }, depth.current + 1);
  }

  /** Answering again after going Back from a result starts over, so that result goes. */
  function changeAnswers(change: (current: PracticeSession) => PracticeSession) {
    if (result) clearResult();
    commitSession((current) => (current ? change(current) : current));
  }

  function confirmAnswer() {
    if (!currentQuestion) return;
    // Counted before grading: an answered question takes no more time.
    const pending = timer.take();
    changeAnswers((current) =>
      confirmPracticeAnswer(addPracticeTime(current, pending), currentQuestion),
    );
  }

  function submit() {
    const current = sessionRef.current;
    if (!current) return;
    const timed = addPracticeTime(current, timer.take());
    commitSession(timed);
    const { unanswered } = summarizePractice(timed);
    if (
      unanswered &&
      !window.confirm(
        `還有 ${unanswered} 題尚未確認答案，這些題目不會計入正確率。確定要完成練習嗎？`,
      )
    ) {
      return;
    }
    // Saved once, here: 已作答紀錄 and 常錯題目 keep every submission with an answer.
    for (const record of createPracticeAttempts(timed, questionById)) {
      dispatch({ type: 'save-attempt', ...record });
    }
    setResult(createPracticeResult(timed));
    setResultShown(true);
    commitSession(resetPracticeAnswers(timed));
    navigate('push', { view: 'result' }, depth.current + 1);
  }

  function abandon() {
    const current = sessionRef.current;
    if (!current || !confirmDiscard()) return;
    timer.take();
    setSubject(current.subject);
    clearResult();
    commitSession(null);
    leaveSetHistory(undefined);
    scrollToTop();
  }

  function retrySet() {
    const current = sessionRef.current;
    if (
      !current ||
      (hasPracticeAnswers(current) &&
        !confirmDiscard('這組題目已有新的作答進度，確定要清除並重做嗎？'))
    ) {
      return;
    }
    timer.take();
    clearResult();
    commitSession(resetPracticeAnswers(current));
    navigate('replace', { q: 1 }, depth.current);
  }

  function newDraw() {
    const current = sessionRef.current;
    if (current && hasPracticeAnswers(current) && !confirmDiscard()) return;
    timer.take();
    if (current) setSubject(current.subject);
    clearResult();
    commitSession(null);
    leaveSetHistory(undefined);
    scrollToTop();
  }

  let content;
  if (view === 'loading') {
    content = (
      <div className={styles.loading}>
        <IconLoader2 size={26} aria-hidden="true" />
        <span>正在讀取練習進度…</span>
      </div>
    );
  } else if (view === 'setup') {
    content = (
      <PracticeSetup
        subject={subject}
        settings={settings}
        pool={pool}
        loading={bank.status === 'loading'}
        loadFailed={bank.status === 'error'}
        onRetry={bank.retry}
        onSubjectChange={changeSubject}
        onSettingsChange={setSettings}
        onStart={startPractice}
        onMakePaper={makePaper}
      />
    );
  } else if (view === 'result' && result) {
    content = (
      <PracticeResultView
        result={result}
        questionById={questionById}
        onRetry={retrySet}
        onNewDraw={newDraw}
      />
    );
  } else if (session && currentId) {
    const status: PracticeQuestionStatus = currentQuestion
      ? 'ready'
      : bank.status === 'loading'
        ? 'loading'
        : bank.status === 'error'
          ? 'error'
          : 'missing';
    content = (
      <PracticeQuiz
        session={session}
        question={currentQuestion}
        status={status}
        timer={timer}
        onRetry={bank.retry}
        onSelect={(selected) =>
          changeAnswers((current) => selectPracticeOption(current, currentId, selected))
        }
        onToggleEliminated={(option) =>
          changeAnswers((current) =>
            togglePracticeElimination(current, currentId, option),
          )
        }
        onConfirm={confirmAnswer}
        onGoTo={goTo}
        onSubmit={submit}
        onAbandon={abandon}
      />
    );
  }

  return (
    <div className={view === 'question' || view === 'result' ? `${styles.root} ${styles.fullWidth}` : styles.root} onClickCapture={ignoreRepeatClick}>
      {content}
    </div>
  );
}
