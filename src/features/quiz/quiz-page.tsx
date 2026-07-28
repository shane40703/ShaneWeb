import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconExternalLink,
  IconLoader2,
  IconPlugConnectedX,
  IconX,
} from '@tabler/icons-react';
import { AttemptReview } from '@/components/attempt-review';
import {
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import { DifficultButton } from '@/components/difficult-button';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { Button, OptionGroup } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import {
  calculateScore,
  createAttempt,
  formatCorrectAnswer,
  formatDuration,
  getQuestionDisplayCategories,
  getSubjectScoreConfig,
  isQuestionCorrect,
  toQuizQuestion,
} from '@/lib/study';
import type { Question, QuizAttempt, QuizQuestion } from '@/lib/types';
import { useClientReady } from '@/lib/use-client-ready';
import { useAppState } from '@/state/app-state';
import {
  createQuizProgressScope,
  createQuizQuestionSearch,
  getQuizElapsedSeconds,
  readQuizProgress,
  scopedQuizProgressReducer,
  writeQuizProgress,
  type QuizProgressAction,
  type ScopedQuizProgressState,
} from './quiz-state';
import styles from './quiz-page.module.css';

export interface StaticQuestionPageProps {
  question: Question;
  /** Only the current paper — the rest of the subject is fetched on demand. */
  paper: QuizQuestion[];
}

const EMPTY_PROGRESS: ScopedQuizProgressState['progress'] = {};

function formatQuestionProgressLabel({
  isRandomQuiz,
  isSingleQuestion,
  position,
  questionNumber,
  total,
}: {
  isRandomQuiz: boolean;
  isSingleQuestion: boolean;
  position: number;
  questionNumber: number;
  total: number;
}) {
  if (isSingleQuestion) return `第 ${questionNumber} 題`;
  if (isRandomQuiz) {
    return `題組 ${position + 1} / ${total}・原題第 ${questionNumber} 題`;
  }
  return `第 ${position + 1} / ${total} 題`;
}

function createRandomQuizSessionId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function QuizPage({ question, paper }: StaticQuestionPageProps) {
  const router = useRouter();
  const { state, dispatch, reportPersistence } = useAppState();
  const [progressState, progressDispatch] = useReducer(scopedQuizProgressReducer, {
    scope: null,
    progress: EMPTY_PROGRESS,
  });
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [checkedSingleQuestionId, setCheckedSingleQuestionId] =
    useState<string | null>(null);
  const routeHydrated = useClientReady();
  const pendingRandomSessionId = useRef<string | null>(null);
  const subject = getSubject(question.subject);
  const questionHasImage = question.content.some((block) => block.kind === 'image');
  const difficult = state.difficultQuestionIds.includes(question.id);
  const isSingleQuestion =
    routeHydrated && router.isReady && router.query.mode === 'single';
  const singleAnswerChecked =
    isSingleQuestion && checkedSingleQuestionId === question.id;

  const randomQuestionIds = useMemo(() => {
    if (
      !routeHydrated ||
      !router.isReady ||
      router.query.mode !== 'random' ||
      typeof router.query.questions !== 'string'
    ) {
      return [];
    }
    return [...new Set(router.query.questions.split(',').filter(Boolean))];
  }, [
    routeHydrated,
    router.isReady,
    router.query.mode,
    router.query.questions,
  ]);
  const isRandomMode = randomQuestionIds.length > 0;
  const queryRandomSessionId =
    typeof router.query.quizSession === 'string' && router.query.quizSession
      ? router.query.quizSession
      : null;

  const paperById = useMemo(() => new Map(paper.map((item) => [item.id, item])), [paper]);
  // A random set may reach into other years, which this page cannot carry at
  // build time. Only those extras are fetched — a set drawn from this paper
  // alone needs no request at all.
  const missingRandomIds = useMemo(
    () => randomQuestionIds.filter((questionId) => !paperById.has(questionId)),
    [randomQuestionIds, paperById],
  );
  const randomBank = useSubjectQuestions(
    missingRandomIds.length ? [question.subject] : [],
  );
  const randomPending = missingRandomIds.length > 0 && randomBank.status !== 'ready';

  const questionById = useMemo(
    () =>
      new Map<string, QuizQuestion>([
        ...randomBank.questions.map((item) => [item.id, toQuizQuestion(item)] as const),
        ...paper.map((item) => [item.id, item] as const),
      ]),
    [paper, randomBank.questions],
  );

  const randomQuestions = useMemo(
    () =>
      randomQuestionIds.flatMap((questionId) => {
        const item = questionById.get(questionId);
        return item ? [item] : [];
      }),
    [randomQuestionIds, questionById],
  );

  const isRandomQuiz =
    isRandomMode && randomQuestions.some((item) => item.id === question.id);
  const currentQuizQuestion = questionById.get(question.id);
  const currentQuestionPath = currentQuizQuestion?.path;
  const paperQuestions = isRandomQuiz
    ? randomQuestions
    : isSingleQuestion
      ? currentQuizQuestion
        ? [currentQuizQuestion]
        : []
      : paper;
  const quizProgressScope = useMemo(() => {
    if (!routeHydrated || !router.isReady) return null;
    if (isRandomQuiz) {
      return createQuizProgressScope({
        mode: 'random',
        questionIds: randomQuestionIds,
        sessionId: queryRandomSessionId,
      });
    }
    return isSingleQuestion
      ? createQuizProgressScope({ mode: 'single', questionId: question.id })
      : createQuizProgressScope({
          mode: 'paper',
          subject: question.subject,
          year: question.year,
        });
  }, [
    isRandomQuiz,
    isSingleQuestion,
    question.id,
    question.subject,
    question.year,
    queryRandomSessionId,
    randomQuestionIds,
    routeHydrated,
    router.isReady,
  ]);
  const progressByQuestion =
    progressState.scope === quizProgressScope ? progressState.progress : EMPTY_PROGRESS;
  const progress = progressByQuestion[question.id];
  const selected = progress?.selected;
  const eliminatedOptions = progress?.eliminatedOptions ?? [];
  const elapsedSeconds = getQuizElapsedSeconds(
    progressByQuestion,
    paperQuestions.map((item) => item.id),
  );
  const position = paperQuestions.findIndex((item) => item.id === question.id);
  const questionSearch = isRandomQuiz
    ? createQuizQuestionSearch({
        mode: 'random',
        questionIds: randomQuestionIds,
        sessionId: queryRandomSessionId,
      })
    : isSingleQuestion
      ? createQuizQuestionSearch({ mode: 'single', questionId: question.id })
      : createQuizQuestionSearch({
          mode: 'paper',
          subject: question.subject,
          year: question.year,
        });
  const questionHref = (item: QuizQuestion) => `${item.path}${questionSearch}`;
  const previous = paperQuestions[position - 1];
  const next = paperQuestions[position + 1];
  const navigationPending =
    !routeHydrated ||
    !router.isReady ||
    (isRandomQuiz && (randomPending || !queryRandomSessionId));

  // A random URL created by /random intentionally has no session yet. Adding
  // one here makes every newly-created set independent, including the rare
  // case where two draws contain exactly the same question ids.
  useEffect(() => {
    if (
      !router.isReady ||
      !routeHydrated ||
      !isRandomMode ||
      queryRandomSessionId ||
      !currentQuestionPath
    ) {
      if (!isRandomMode || queryRandomSessionId) {
        pendingRandomSessionId.current = null;
      }
      return;
    }
    const sessionId =
      pendingRandomSessionId.current ?? createRandomQuizSessionId();
    pendingRandomSessionId.current = sessionId;
    void router.replace(
      {
        pathname: currentQuestionPath,
        query: {
          mode: 'random',
          questions: randomQuestionIds.join(','),
          quizSession: sessionId,
        },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [
    currentQuestionPath,
    isRandomMode,
    queryRandomSessionId,
    randomQuestionIds,
    routeHydrated,
    router,
    router.isReady,
  ]);

  // Drafts survive a refresh or an accidental back-navigation within this
  // scope. The scoped reducer ignores timer work left over from another quiz.
  useEffect(() => {
    if (!quizProgressScope) return;
    progressDispatch({
      type: 'restore-scope',
      scope: quizProgressScope,
      progress: readQuizProgress(quizProgressScope),
    });
  }, [quizProgressScope]);

  // Holds the last persisted map; on the first render it is the reducer's own
  // initial value, which keeps an empty map from overwriting stored drafts.
  const persistedProgress = useRef<ScopedQuizProgressState | null>(null);
  useEffect(() => {
    if (!progressState.scope || persistedProgress.current === progressState) return;
    persistedProgress.current = progressState;
    reportPersistence(
      'quiz-progress',
      writeQuizProgress(progressState.scope, progressState.progress),
    );
  }, [progressState, reportPersistence]);

  useEffect(() => {
    if (attempt || singleAnswerChecked || !quizProgressScope) return;
    const questionId = question.id;
    const startedAt = new Date().toISOString();
    progressDispatch({
      type: 'update-scope',
      scope: quizProgressScope,
      action: { type: 'visit-question', questionId, startedAt },
    });
    const timer = window.setInterval(() => {
      progressDispatch({
        type: 'update-scope',
        scope: quizProgressScope,
        action: { type: 'tick-question', questionId, startedAt },
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, question.id, quizProgressScope, singleAnswerChecked]);

  function updateQuizProgress(action: QuizProgressAction) {
    if (!quizProgressScope) return;
    progressDispatch({
      type: 'update-scope',
      scope: quizProgressScope,
      action,
    });
  }

  function submitQuiz() {
    if (attempt) return;

    const answers = Object.fromEntries(
      paperQuestions.flatMap((item) => {
        const itemProgress = progressByQuestion[item.id];
        return itemProgress?.selected === undefined
          ? []
          : [[item.id, itemProgress.selected]];
      }),
    );
    const results = Object.fromEntries(
      paperQuestions.map((item) => [
        item.id,
        isQuestionCorrect(item, progressByQuestion[item.id]?.selected),
      ]),
    );
    const visitedProgress = paperQuestions.flatMap((item) => {
      const itemProgress = progressByQuestion[item.id];
      return itemProgress ? [itemProgress] : [];
    });
    const nextAttempt = createAttempt({
      mode: isRandomQuiz ? 'random' : 'paper',
      source: paperQuestions,
      answers,
      startedAt: visitedProgress.reduce(
        (earliest, item) => (item.startedAt < earliest ? item.startedAt : earliest),
        new Date().toISOString(),
      ),
      elapsedSeconds: visitedProgress.reduce(
        (total, item) => total + item.elapsedSeconds,
        0,
      ),
    });

    dispatch({ type: 'save-attempt', attempt: nextAttempt, results });
    updateQuizProgress({
      type: 'clear-questions',
      questionIds: paperQuestions.map((item) => item.id),
    });
    setAttempt(nextAttempt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function checkSingleAnswer() {
    if (!isSingleQuestion || selected === undefined) return;
    const answeredAt = new Date().toISOString();
    dispatch({
      type: 'save-answer',
      questionId: question.id,
      selected,
      correct: isQuestionCorrect(question, selected),
      answeredAt,
    });
    setCheckedSingleQuestionId(question.id);
  }

  if (attempt) {
    const { maximumScore } = getSubjectScoreConfig(question.subject);
    const score = calculateScore(attempt.correctCount, question.subject);
    const resultValue = isRandomQuiz ? attempt.correctCount : score;
    const resultMaximum = isRandomQuiz ? paperQuestions.length : maximumScore;
    const resultPercentage = resultMaximum
      ? Math.min(100, Math.max(0, (resultValue / resultMaximum) * 100))
      : 0;

    return (
      <>
        <section className={styles.resultCard}>
          <div
            className={styles.scoreRing}
            style={
              {
                '--score-percentage': `${resultPercentage}%`,
              } as CSSProperties
            }
            role="progressbar"
            aria-valuemin={0}
            aria-valuenow={resultValue}
            aria-valuemax={resultMaximum}
            aria-label={
              isRandomQuiz
                ? `答對 ${attempt.correctCount} 題，共 ${paperQuestions.length} 題`
                : `本次得分 ${score.toFixed(2)} 分，滿分 ${maximumScore.toFixed(2)} 分`
            }
          >
            <strong>
              {isRandomQuiz
                ? `${attempt.correctCount} / ${paperQuestions.length}`
                : score.toFixed(2)}
            </strong>
            <span>
              {isRandomQuiz ? '題答對' : `/ ${maximumScore.toFixed(2)} 分`}
            </span>
          </div>
          <div className={styles.resultSummary}>
            <h2>
              {attempt.correctCount} / {paperQuestions.length} 題答對
            </h2>
            <p>
              已作答 {paperQuestions.length - attempt.unansweredCount} 題・ 未作答{' '}
              {attempt.unansweredCount} 題
            </p>
            <div className={styles.resultStats}>
              <div data-tone="success">
                <strong>{attempt.correctCount}</strong>
                <span>答對</span>
              </div>
              <div data-tone="danger">
                <strong>{attempt.wrongCount}</strong>
                <span>答錯</span>
              </div>
              <div>
                <strong>{attempt.unansweredCount}</strong>
                <span>未作答</span>
              </div>
              <div>
                <strong>{formatDuration(attempt.elapsedSeconds)}</strong>
                <span>總時間</span>
              </div>
            </div>
          </div>
        </section>
        <div className={styles.resultReviewLayout}>
          <AttemptReview
            attempt={attempt}
            questions={paperQuestions}
            anchorPrefix="result-question"
          />
          <aside className={styles.questionNavigator} aria-label="作答結果題號導覽">
            <header>
              <div>
                <span>RESULT MAP</span>
                <h2>題號導覽</h2>
              </div>
              <strong>
                {attempt.correctCount}/{paperQuestions.length}
              </strong>
            </header>
            <div className={styles.questionNumbers}>
              <QuestionNumberGrid>
                {paperQuestions.map((item) => {
                  const itemDifficult = state.difficultQuestionIds.includes(item.id);
                  const itemSelected = attempt.answers[item.id];
                  const itemWrong =
                    itemSelected !== undefined && !isQuestionCorrect(item, itemSelected);

                  return (
                    <QuestionNumberButton
                      key={item.id}
                      href={`#result-question-${item.id}`}
                      ariaLabel={`查看第 ${item.questionNumber} 題結果`}
                      active={false}
                      answered={itemSelected !== undefined}
                      difficult={itemDifficult}
                      wrong={itemWrong}
                    >
                      {item.questionNumber}
                    </QuestionNumberButton>
                  );
                })}
              </QuestionNumberGrid>
            </div>
            <footer className={styles.navigatorLegend}>
              <span>
                <i data-tone="wrong" />
                答錯
              </span>
              <span>
                <i data-tone="difficult" />
                難題
              </span>
              <span>
                <i data-tone="combined" />
                答錯＋難題
              </span>
            </footer>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.quizLayout}>
        <section className={styles.card}>
          <header className={styles.quizHeader}>
            <div className={styles.meta}>
              <Tag tone="green">{subject?.shortName}</Tag>
              <Tag>{question.year} 年</Tag>
              {getQuestionDisplayCategories(question).map((category) => (
                <Tag tone="orange" key={category}>{category}</Tag>
              ))}
              {question.source.kind === 'sample' ? <Tag tone="purple">示範題</Tag> : null}
            </div>
            <div className={styles.quizActions}>
              <DifficultButton
                active={difficult}
                onClick={() =>
                  dispatch({
                    type: 'toggle-difficult',
                    questionId: question.id,
                  })
                }
              />
            </div>
          </header>
          <div
            className={styles.questionBody}
            data-has-image={questionHasImage || undefined}
          >
            <div className={styles.questionContentColumn}>
              <QuestionSourceLine question={question} />
              <span className={styles.questionNumber}>
                {formatQuestionProgressLabel({
                  isRandomQuiz,
                  isSingleQuestion,
                  position,
                  questionNumber: question.questionNumber,
                  total: paperQuestions.length,
                })}
              </span>
              <QuestionPrompt question={question} />
            </div>
            <div className={styles.answerColumn}>
              <OptionGroup
                label="請選擇答案"
                options={question.options}
                value={selected}
                disabled={!quizProgressScope || singleAnswerChecked}
                eliminatedValues={eliminatedOptions}
                onValueChange={(value) =>
                  updateQuizProgress({
                    type: 'select-answer',
                    questionId: question.id,
                    selected: value,
                    startedAt: new Date().toISOString(),
                  })
                }
                onToggleEliminated={(option) =>
                  updateQuizProgress({
                    type: 'toggle-eliminated-option',
                    questionId: question.id,
                    option,
                    startedAt: new Date().toISOString(),
                  })
                }
              />
              {singleAnswerChecked && selected !== undefined ? (
                <section
                  className={styles.singleFeedback}
                  data-result={
                    isQuestionCorrect(question, selected) ? 'correct' : 'wrong'
                  }
                  role="status"
                >
                  <header>
                    {isQuestionCorrect(question, selected) ? (
                      <IconCircleCheck
                        size={21}
                        stroke={2.3}
                        aria-hidden="true"
                      />
                    ) : (
                      <IconX size={21} stroke={2.3} aria-hidden="true" />
                    )}
                    <strong>
                      {isQuestionCorrect(question, selected)
                        ? '答對了'
                        : '答錯了'}
                    </strong>
                  </header>
                  <p>
                    你的答案：{String.fromCharCode(65 + selected)}
                    <b>標準答案：{formatCorrectAnswer(question)}</b>
                  </p>
                  <div>
                    <span>詳解</span>
                    <p>
                      {question.explanation?.trim() ||
                        (question.answerKey.kind === 'all-credit'
                          ? '本題一律給分。'
                          : '目前尚無詳解。')}
                    </p>
                  </div>
                </section>
              ) : null}
              {isRandomQuiz || isSingleQuestion ? (
                <Button
                  variant="ghost"
                  render={<Link href={`/community?question=${question.id}`} />}
                >
                  前往詳解與討論{' '}
                  <IconExternalLink size={17} stroke={2} aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
          <footer className={styles.navigation}>
            <div className={styles.timer}>
              <span>作答時間</span>
              <strong>{formatDuration(elapsedSeconds)}</strong>
            </div>
            <div className={styles.navigationButtons}>
              {previous && !navigationPending ? (
                <Button render={<Link href={questionHref(previous)} />}>
                  <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
                </Button>
              ) : (
                <Button disabled>
                  <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
                </Button>
              )}
              {navigationPending ? (
                <Button variant="primary" disabled>
                  <IconLoader2 size={17} stroke={2} aria-hidden="true" />{' '}
                  {isRandomQuiz ? '載入題組中' : '準備作答中'}
                </Button>
              ) : isSingleQuestion ? (
                <Button
                  variant="primary"
                  disabled={!singleAnswerChecked && selected === undefined}
                  onClick={() =>
                    singleAnswerChecked
                      ? setCheckedSingleQuestionId(null)
                      : checkSingleAnswer()
                  }
                >
                  {singleAnswerChecked ? '重新作答' : '對答案'}
                </Button>
              ) : next ? (
                <Button variant="primary" render={<Link href={questionHref(next)} />}>
                  下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
                </Button>
              ) : (
                <Button variant="primary" onClick={submitQuiz}>
                  對答案
                </Button>
              )}
            </div>
          </footer>
        </section>

        <aside className={styles.questionNavigator} aria-label="題號導覽">
          <header>
            <h2>題號導覽</h2>
          </header>
          <div className={styles.questionNumbers}>
            {randomBank.status === 'error' ? (
              <p className={styles.navigatorNotice} role="alert">
                <IconPlugConnectedX size={16} stroke={2} aria-hidden="true" />
                題組載入失敗
                <Button onClick={randomBank.retry}>重新載入</Button>
              </p>
            ) : randomPending ? (
              <p className={styles.navigatorNotice}>
                <IconLoader2 size={16} stroke={2} aria-hidden="true" />
                正在載入這次抽出的題目…
              </p>
            ) : isRandomQuiz && !queryRandomSessionId ? (
              <p className={styles.navigatorNotice}>
                <IconLoader2 size={16} stroke={2} aria-hidden="true" />
                正在建立這次作答…
              </p>
            ) : null}
            {!navigationPending ? (
              <QuestionNumberGrid>
                {paperQuestions.map((item, index) => {
                  const itemDifficult = state.difficultQuestionIds.includes(item.id);

                  return (
                    <QuestionNumberButton
                      key={item.id}
                      href={questionHref(item)}
                      ariaLabel={`前往第 ${item.questionNumber} 題`}
                      active={index === position}
                      answered={progressByQuestion[item.id]?.selected !== undefined}
                      difficult={itemDifficult}
                    >
                      {item.questionNumber}
                    </QuestionNumberButton>
                  );
                })}
              </QuestionNumberGrid>
            ) : null}
          </div>
          <footer className={styles.navigatorLegend}>
            <span>
              <i data-tone="current" />
              目前題目
            </span>
            <span>
              <i data-tone="answered" />
              已作答
            </span>
            <span>
              <i data-tone="difficult" />
              難題
            </span>
          </footer>
        </aside>
      </div>
    </>
  );
}
