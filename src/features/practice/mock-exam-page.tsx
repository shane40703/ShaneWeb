import { useRouter } from 'next/router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from 'react';
import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import {
  QUIZ_PROGRESS_STORAGE_KEY,
  parseStoredQuizProgress,
  quizProgressReducer,
  type QuizProgressAction,
} from './mock-exam-progress';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { parseQuestionId } from '@/lib/question-path';
import { isQuestionCorrect, isSubjectId, parseYear } from '@/lib/study';
import type { SubjectId } from '@/lib/types';
import { useClientReady } from '@/lib/use-client-ready';
import { useAppState } from '@/state/app-state';
import {
  addMockExamTime,
  createMockExamAttempt,
  getMockExamQuestions,
  hasMockExamDraft,
  isMockExamStarted,
  listMockExamDrafts,
  mockExamHref,
  mockExamQuestionId,
  mockExamScope,
  mockExamSubmitWarning,
  startMockExamDraft,
  touchMockExamQuestion,
  summarizeMockExamDraft,
  type MockExamPaper,
} from './mock-exam';
import { MockExamQuiz } from './mock-exam-quiz';
import { MockExamResult } from './mock-exam-result';
import { MockExamSetup } from './mock-exam-setup';
import {
  readMockExamDraft,
  readMockExamDrafts,
  saveMockExamDraft,
  subscribeToMockExamDrafts,
} from './mock-exam-store';
import type { PracticeQuestionStatus } from './practice-quiz';
import { createPracticeTimer } from './practice-session';
import styles from './practice-page.module.css';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function scrollToTop() {
  // 'instant' overrides the global smooth scrolling for a whole-page jump.
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/** As on the multiple-choice practice: a double-click must not act on what appears next. */
function ignoreRepeatClick(event: MouseEvent) {
  if (event.detail <= 1) return;
  event.preventDefault();
  event.stopPropagation();
}

const noDrafts = () => null;

/**
 * A whole past paper in its original order: choose it, answer it like the exam and
 * submit for the official score. The URL holds the paper and the question, so a
 * reload, Back and Forward keep the place; the draft stays saved until 交卷.
 */
export function MockExamPage({ papers }: { papers: MockExamPaper[] }) {
  const router = useRouter();
  const ready = useClientReady();
  const routeReady = ready && router.isReady;
  const { state, dispatch, hydrated, reportPersistence } = useAppState();
  const [timer] = useState(createPracticeTimer);
  const ownNavigations = useRef(0);
  // The timed question's saved entry as this window last knew it, to tell the seconds
  // another window counted on the same question from this window's own.
  const timedEntry = useRef<{
    questionId: string;
    startedAt: string;
    elapsedSeconds: number;
  } | null>(null);
  const raw = useSyncExternalStore(
    subscribeToMockExamDrafts,
    readMockExamDrafts,
    noDrafts,
  );

  const requestedSubject = first(router.query.subject);
  const subject: SubjectId = isSubjectId(requestedSubject) ? requestedSubject : 'law';
  const requestedYear = parseYear(router.query.year);
  const subjectPapers = papers.filter((item) => item.subject === subject);
  const paper =
    subjectPapers.find((item) => item.year === requestedYear) ?? subjectPapers[0];
  const requestedQuestion = first(router.query.q);
  const resultId = first(router.query.result) || null;
  const view = !routeReady
    ? 'loading'
    : !paper
      ? 'empty'
      : resultId
        ? 'result'
        : requestedQuestion !== undefined
          ? 'question'
          : 'setup';

  const scope = paper ? mockExamScope(paper.subject, paper.year) : null;
  const progress = useMemo(
    () => (scope ? (parseStoredQuizProgress(raw)[scope] ?? {}) : {}),
    [raw, scope],
  );
  const drafts = useMemo(() => listMockExamDrafts(raw, papers), [papers, raw]);
  const hasDraft = hasMockExamDraft(progress);
  const total = paper?.questionCount ?? 0;
  const paperSubject = paper?.subject;
  const paperYear = paper?.year;
  const questionIds = useMemo(
    () =>
      paperSubject && paperYear
        ? Array.from({ length: total }, (_, index) =>
            mockExamQuestionId(paperSubject, paperYear, index + 1),
          )
        : [],
    [paperSubject, paperYear, total],
  );
  const position =
    requestedQuestion !== undefined && /^\d+$/.test(requestedQuestion)
      ? Number(requestedQuestion)
      : 0;
  const index = position >= 1 && position <= total ? position - 1 : null;
  const currentId = index === null ? undefined : questionIds[index];

  // Only answering and the result need the paper itself: one year of one subject.
  const needsQuestions = view === 'question' || view === 'result';
  const bank = useSubjectQuestions(
    needsQuestions && paper ? [paper.subject] : [],
    paper ? [paper.year] : [],
  );
  const questions = useMemo(
    () =>
      paperSubject && paperYear
        ? getMockExamQuestions(bank.questions, paperSubject, paperYear)
        : [],
    [bank.questions, paperSubject, paperYear],
  );
  const question = currentId
    ? questions.find((item) => item.id === currentId)
    : undefined;
  const status: PracticeQuestionStatus = question
    ? 'ready'
    : bank.status === 'loading'
      ? 'loading'
      : bank.status === 'error'
        ? 'error'
        : 'missing';
  const attempt =
    view === 'result' && hydrated && paper
      ? state.attempts.find(
          (item) =>
            item.id === resultId &&
            item.mode === 'paper' &&
            item.subject === paper.subject &&
            item.year === paper.year,
        )
      : undefined;

  const save = useCallback(
    (draftScope: string, next: Parameters<typeof saveMockExamDraft>[1]) => {
      reportPersistence('quiz-progress', saveMockExamDraft(draftScope, next));
    },
    [reportPersistence],
  );

  /** Moves the clock's uncounted seconds into the draft of the paper they belong to. */
  const flushTimer = useCallback(() => {
    const pending = timer.take();
    const parsed = pending ? parseQuestionId(pending.questionId) : null;
    if (!pending || !parsed) return;
    const pendingScope = mockExamScope(parsed.subject, parsed.year);
    const stored = readMockExamDraft(pendingScope);
    // A submitted or restarted paper drops the seconds with it.
    if (!hasMockExamDraft(stored)) return;
    const next = addMockExamTime(stored, pending.questionId, pending.seconds);
    save(pendingScope, next);
    const entry = next[pending.questionId];
    if (entry && timedEntry.current?.questionId === pending.questionId) {
      timedEntry.current = {
        ...timedEntry.current,
        elapsedSeconds: entry.elapsedSeconds,
      };
    }
  }, [save, timer]);

  // Two windows counting the same question count it once, as on 選擇題練習; seconds of a
  // paper submitted or restarted in another window are dropped.
  useEffect(() => {
    function discountOtherWindows(event: StorageEvent) {
      if (event.key !== null && event.key !== QUIZ_PROGRESS_STORAGE_KEY) return;
      const pending = timer.peek();
      const known = timedEntry.current;
      const parsed = pending ? parseQuestionId(pending.questionId) : null;
      if (!pending || !parsed || known?.questionId !== pending.questionId) return;
      const stored = readMockExamDraft(mockExamScope(parsed.subject, parsed.year))[
        pending.questionId
      ];
      if (!stored || stored.startedAt !== known.startedAt) {
        timer.take();
        timedEntry.current = null;
        return;
      }
      timer.discount(pending.questionId, stored.elapsedSeconds - known.elapsedSeconds);
      timedEntry.current = { ...known, elapsedSeconds: stored.elapsedSeconds };
    }
    window.addEventListener('storage', discountOtherWindows);
    return () => window.removeEventListener('storage', discountOtherWindows);
  }, [timer]);

  const navigate = useCallback(
    (method: 'push' | 'replace', href: string) => {
      ownNavigations.current += 1;
      return Promise.resolve(
        router[method](href, undefined, { shallow: true, scroll: false }),
      )
        .catch(() => false)
        .finally(() => {
          ownNavigations.current -= 1;
        });
    },
    [router],
  );

  // A question URL needs its paper's draft: a stale link, or Back after 交卷, lands on
  // the paper's setup instead of silently starting the paper again.
  useEffect(() => {
    if (view !== 'question' || !paper || ownNavigations.current > 0) return;
    const setup = mockExamHref({ subject: paper.subject, year: paper.year });
    if (!hasDraft) {
      void navigate('replace', setup);
      return;
    }
    if (index === null) {
      const resume = summarizeMockExamDraft(progress, questionIds).resumeIndex;
      void navigate(
        'replace',
        mockExamHref({ subject: paper.subject, year: paper.year, q: resume + 1 }),
      );
    }
  }, [hasDraft, index, navigate, paper, progress, questionIds, view]);

  // Opening a question marks it, which dates the draft and keeps it resumable. Read from
  // storage, not this render: leaving the previous question has just saved its time.
  useEffect(() => {
    if (view !== 'question' || !scope || !currentId) return;
    const stored = readMockExamDraft(scope);
    if (!hasMockExamDraft(stored)) return;
    let entry = stored[currentId];
    if (!entry) {
      const next = quizProgressReducer(stored, {
        type: 'visit-question',
        questionId: currentId,
        startedAt: new Date().toISOString(),
      });
      save(scope, next);
      entry = next[currentId];
    }
    if (entry && timedEntry.current?.questionId !== currentId) {
      timedEntry.current = {
        questionId: currentId,
        startedAt: entry.startedAt,
        elapsedSeconds: entry.elapsedSeconds,
      };
    }
  }, [currentId, progress, save, scope, view]);

  // Time counts only on a shown question of a running paper, and not in the background.
  const timing = view === 'question' && hasDraft && Boolean(question);
  useEffect(() => {
    if (!timing || !currentId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') timer.tick(currentId);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [currentId, timer, timing]);

  // Leaving a question, the page or the tab saves the seconds counted on it.
  useEffect(
    () => () => {
      flushTimer();
      // The next question view reads its entry afresh.
      timedEntry.current = null;
    },
    [currentId, flushTimer, view],
  );
  useEffect(() => {
    function saveWhenHidden() {
      if (document.visibilityState === 'hidden') flushTimer();
    }
    window.addEventListener('pagehide', flushTimer);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      window.removeEventListener('pagehide', flushTimer);
      document.removeEventListener('visibilitychange', saveWhenHidden);
    };
  }, [flushTimer]);

  if (view === 'loading') {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>
          <IconLoader2 size={26} aria-hidden="true" />
          <span>正在讀取模擬考…</span>
        </div>
      </div>
    );
  }

  if (!paper || !scope) {
    return (
      <div className={styles.root}>
        <div className={styles.loading} role="status">
          <span>目前沒有可作答的試卷。</span>
        </div>
      </div>
    );
  }

  const setupHref = mockExamHref({ subject: paper.subject, year: paper.year });
  const firstQuestionId = questionIds[0];

  function start() {
    if (!paper || !scope || !firstQuestionId) return;
    save(scope, startMockExamDraft(firstQuestionId));
    void navigate(
      'push',
      mockExamHref({ subject: paper.subject, year: paper.year, q: 1 }),
    );
    scrollToTop();
  }

  function update(action: Extract<QuizProgressAction, { questionId: string }>) {
    if (!scope) return;
    const stored = readMockExamDraft(scope);
    if (!hasMockExamDraft(stored)) return;
    const next = quizProgressReducer(stored, action);
    if (next !== stored) save(scope, touchMockExamQuestion(next, action.questionId));
  }

  function goTo(next: number) {
    if (!paper) return;
    const target = Math.max(0, Math.min(next, total - 1));
    // Replaced, not pushed: Back leaves the paper instead of stepping through it.
    void navigate(
      'replace',
      mockExamHref({ subject: paper.subject, year: paper.year, q: target + 1 }),
    );
    scrollToTop();
  }

  function submit() {
    if (!paper || !scope) return;
    flushTimer();
    const stored = readMockExamDraft(scope);
    if (!hasMockExamDraft(stored) || questions.length < total) return;
    const warning = mockExamSubmitWarning(questions, stored);
    if (warning && !window.confirm(warning)) return;
    const submitted = createMockExamAttempt(questions, stored);
    dispatch({
      type: 'save-attempt',
      attempt: submitted,
      results: Object.fromEntries(
        questions.map((item) => [
          item.id,
          isQuestionCorrect(item, stored[item.id]?.selected),
        ]),
      ),
    });
    // Routed first, so the cleared draft does not send the question view to the setup.
    // The result takes the exam's place: Back goes to the setup, then off the page.
    void navigate(
      'replace',
      mockExamHref({ subject: paper.subject, year: paper.year, result: submitted.id }),
    );
    save(scope, {});
    scrollToTop();
  }

  function restart() {
    if (window.confirm('確定要清除這份試卷的作答進度並重新開始嗎？')) start();
  }

  let content;
  if (view === 'setup') {
    content = (
      <MockExamSetup
        papers={papers}
        paper={paper}
        drafts={drafts}
        attempts={hydrated ? state.attempts : []}
        onSubjectChange={(next) =>
          void navigate(
            'replace',
            // The same year when that subject has it, else its newest paper.
            mockExamHref({
              subject: next,
              year: papers.some(
                (item) => item.subject === next && item.year === paper.year,
              )
                ? paper.year
                : undefined,
            }),
          )
        }
        onYearChange={(year) =>
          void navigate('replace', mockExamHref({ subject: paper.subject, year }))
        }
        onStart={start}
        onResume={(resume) => {
          // From the setup the paper is a new stop, so Back returns to the setup.
          void navigate(
            'push',
            mockExamHref({ subject: paper.subject, year: paper.year, q: resume + 1 }),
          );
          scrollToTop();
        }}
        onRestart={restart}
      />
    );
  } else if (view === 'result') {
    content = !hydrated ? (
      <div className={styles.loading}>
        <IconLoader2 size={26} aria-hidden="true" />
        <span>正在讀取作答結果…</span>
      </div>
    ) : attempt ? (
      <MockExamResult
        paper={paper}
        attempt={attempt}
        questions={questions}
        status={
          bank.status === 'loading'
            ? 'loading'
            : bank.status === 'error'
              ? 'error'
              : 'ready'
        }
        onRetry={bank.retry}
        onRetake={() =>
          // Answers in progress are never replaced from here: the setup offers both.
          isMockExamStarted(readMockExamDraft(scope))
            ? void navigate('push', setupHref)
            : start()
        }
        onChooseAnother={() => void navigate('push', setupHref)}
      />
    ) : (
      <div className={styles.loading} role="alert">
        <IconAlertTriangle size={26} aria-hidden="true" />
        <span>找不到這次的作答結果，可能已從已作答紀錄清除。</span>
        <Button onClick={() => void navigate('replace', setupHref)}>回到選卷</Button>
      </div>
    );
  } else if (hasDraft && index !== null) {
    content = (
      <MockExamQuiz
        paper={paper}
        question={question}
        status={status}
        index={index}
        progress={progress}
        timer={timer}
        canSubmit={questions.length >= total}
        onRetry={bank.retry}
        onSelect={(selected) =>
          currentId &&
          update({
            type: 'select-answer',
            questionId: currentId,
            selected,
            startedAt: new Date().toISOString(),
          })
        }
        onToggleEliminated={(option) =>
          currentId &&
          update({
            type: 'toggle-eliminated-option',
            questionId: currentId,
            option,
            startedAt: new Date().toISOString(),
          })
        }
        onGoTo={goTo}
        onSubmit={submit}
        onLeave={() => void navigate('push', setupHref)}
      />
    );
  } else {
    content = (
      <div className={styles.loading}>
        <IconLoader2 size={26} aria-hidden="true" />
        <span>正在準備試卷…</span>
      </div>
    );
  }

  return (
    <div className={styles.root} onClickCapture={ignoreRepeatClick}>
      {content}
    </div>
  );
}
