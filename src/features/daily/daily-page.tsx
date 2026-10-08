import { useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconCalendarClock,
  IconCircleCheck,
  IconFlag3,
  IconLoader2,
  IconLock,
  IconRefresh,
  IconShieldX,
  IconTargetArrow,
  IconTrophy,
  IconX,
} from '@tabler/icons-react';
import { DifficultButton } from '@/components/difficult-button';
import { ReviewNoteEditor } from '@/components/attempt-review';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { QuestionPrompt, Tag } from '@/components/content/content';
import { Button, OptionGroup } from '@/components/ui/ui';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { formatCorrectAnswer, isQuestionCorrect } from '@/lib/study';
import { useClientReady } from '@/lib/use-client-ready';
import type { Question, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import {
  applyDailyOptionOrder,
  createDailyCompletionResult,
  createDailyPracticeSession,
  DAILY_COMPLETION_STORAGE_KEY,
  DAILY_LEVEL_SIZE,
  DAILY_PRACTICE_STORAGE_KEY,
  DAILY_QUESTIONS_PER_SUBJECT,
  DAILY_WRONG_LIMIT,
  getTaipeiDateKey,
  getMillisecondsUntilTaipeiMidnight,
  parseDailyCompletionRecord,
  parseDailyPracticeSession,
  shouldEnterDailyReview,
  type DailyCompletionRecord,
  type DailyCompletionResult,
  type DailyPracticeSession,
} from './daily-practice';
import styles from './daily-page.module.css';

function subjectShortName(subjectId: SubjectId | undefined) {
  return subjects.find((subject) => subject.id === subjectId)?.shortName ?? '';
}

function removeStoredSession() {
  try {
    window.localStorage.removeItem(DAILY_PRACTICE_STORAGE_KEY);
  } catch {
    // The in-memory reset still works when private browsing blocks storage.
  }
}

function DailySetup({
  selectedSubjects,
  completedSubjects,
  completionResults,
  onToggleSubject,
  onStart,
  questions,
  loading,
  loadFailed,
  onRetry,
}: {
  selectedSubjects: SubjectId[];
  completedSubjects: SubjectId[];
  completionResults: DailyCompletionRecord['results'];
  onToggleSubject: (subject: SubjectId) => void;
  onStart: () => void;
  questions: Question[];
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
}) {
  const subjectCounts = Object.fromEntries(
    selectedSubjects.map((subject) => [
      subject,
      questions.filter((question) => question.subject === subject).length,
    ]),
  ) as Partial<Record<SubjectId, number>>;
  const readyToStart = selectedSubjects.every(
    (subject) => (subjectCounts[subject] ?? 0) > 0,
  );
  const selectedSubject = selectedSubjects[0];

  return (
    <section className={styles.setup} aria-labelledby="daily-practice-title">
      <div className={styles.hero}>
        <span className={styles.heroIcon} aria-hidden="true">
          <IconTargetArrow size={34} stroke={1.8} />
        </span>
        <div>
          <span className={styles.eyebrow}>DAILY CHALLENGE</span>
          <h2 id="daily-practice-title">每日 50 題闖關</h2>
          <p>選擇一個科目進行 50 題挑戰；各科進度獨立，完成後隔日重新開放。</p>
        </div>
      </div>

      <div className={styles.rules} aria-label="每日練習規則">
        <div><strong>50</strong><span>每科題數</span></div>
        <div><strong>5</strong><span>每層題數</span></div>
        <div><strong>{DAILY_WRONG_LIMIT}</strong><span>答錯上限</span></div>
        <p>每層結束需檢討該層錯題；單層答錯 {DAILY_WRONG_LIMIT} 題時，該科今日練習直接結束。</p>
      </div>

      <fieldset className={styles.subjectChoices}>
        <legend>選擇今日科目</legend>
        {subjects.map((subject) => {
          const checked = selectedSubjects.includes(subject.id);
          const completed = completedSubjects.includes(subject.id);
          const result = completionResults[subject.id];
          return (
            <label
              key={subject.id}
              data-checked={checked || undefined}
              data-completed={completed || undefined}
            >
              <input
                type="radio"
                name="daily-subject"
                checked={checked}
                disabled={completed}
                onChange={() => onToggleSubject(subject.id)}
              />
              <span>
                <strong>{subject.name}</strong>
                <small>
                  {completed ? (
                    <>
                      <IconCalendarClock size={14} />
                      {result
                        ? `今日${result.status === 'failed' ? '挑戰結束' : '已完成'}・答對 ${result.correct} / ${result.answered} 題，明日再開放`
                        : '今日已完成，明日再開放'}
                    </>
                  ) : checked && !loading ? (
                    `題庫 ${subjectCounts[subject.id] ?? 0} 題，今日抽 50 題`
                  ) : (
                    subject.description
                  )}
                </small>
              </span>
            </label>
          );
        })}
      </fieldset>

      {loadFailed ? (
        <div className={styles.notice} role="alert">
          <IconAlertTriangle size={20} aria-hidden="true" />
          <span>部分題庫載入失敗，已載入的科目仍可建立練習。</span>
          <Button onClick={onRetry}>重新載入</Button>
        </div>
      ) : null}

      <footer className={styles.setupFooter}>
        <span>
          {loading ? (
            <><IconLoader2 size={18} aria-hidden="true" /> 正在準備題庫…</>
          ) : selectedSubject ? (
            <>已選 {subjectShortName(selectedSubject)}・今日 50 題</>
          ) : completedSubjects.length === subjects.length ? (
            <>今日四科皆已完成，明天再繼續。</>
          ) : (
            <>請選擇尚未完成的科目。</>
          )}
        </span>
        <Button
          variant="primary"
          disabled={loading || !selectedSubjects.length || !readyToStart}
          onClick={onStart}
        >
          <IconFlag3 size={18} aria-hidden="true" />
          建立今日挑戰
        </Button>
      </footer>
    </section>
  );
}

function ProgressOverview({
  session,
  questionById,
  subject,
  onReset,
}: {
  session: DailyPracticeSession;
  questionById: Map<string, Question>;
  subject: SubjectId;
  onReset: () => void;
}) {
  const questionIds = session.questionIds.filter(
    (id) => questionById.get(id)?.subject === subject,
  );
  const answered = questionIds.filter((id) => session.answers[id]);
  const correct = answered.filter((id) => session.answers[id].correct).length;
  const wrong = session.unreviewedWrongIds.length;
  const currentSubjectPosition = Math.min(
    questionIds.filter((id) => session.questionIds.indexOf(id) < session.currentIndex).length,
    Math.max(0, questionIds.length - 1),
  );
  const currentLevel = Math.floor(currentSubjectPosition / DAILY_LEVEL_SIZE);
  const levelCount = Math.ceil(questionIds.length / DAILY_LEVEL_SIZE);
  const subjectFinished = session.status === 'completed' || session.status === 'failed';

  return (
    <section className={styles.progressOverview} aria-label="每日練習進度與關卡">
      <ol className={styles.levelMap} aria-label={`${subjectShortName(subject)}關卡進度`}>
        {Array.from({ length: levelCount }, (_, index) => {
          const levelQuestionIds = questionIds.slice(
            index * DAILY_LEVEL_SIZE,
            (index + 1) * DAILY_LEVEL_SIZE,
          );
          const complete = levelQuestionIds.every((id) => session.answers[id]);
          const active = !subjectFinished && index === currentLevel;
          return (
            <li
              key={index}
              data-complete={complete || undefined}
              data-active={active || undefined}
            >
              <span>
                {complete ? (
                  <IconCircleCheck size={17} />
                ) : active ? (
                  index + 1
                ) : (
                  <IconLock size={14} />
                )}
              </span>
              <small>{subjectShortName(subject)} {index + 1}</small>
            </li>
          );
        })}
      </ol>
      <div className={styles.scoreboard} aria-label="每日練習統計">
        <span><strong>{answered.length}</strong> / {questionIds.length}<small>已作答</small></span>
        <span><strong>{correct}</strong><small>答對</small></span>
        <span data-danger={wrong >= DAILY_WRONG_LIMIT || undefined}>
          <strong>{wrong}</strong> / {DAILY_WRONG_LIMIT}<small>本層答錯</small>
        </span>
      </div>
      <button type="button" className={styles.reset} onClick={onReset}>
        <IconRefresh size={16} /> 重新選科
      </button>
    </section>
  );
}

function CompletionSummary({
  session,
  subject,
  questionById,
  failed,
  onSelectSubjects,
}: {
  session: DailyPracticeSession;
  subject: SubjectId;
  questionById: Map<string, Question>;
  failed: boolean;
  onSelectSubjects: () => void;
}) {
  const subjectQuestionIds = session.questionIds.filter(
    (id) => questionById.get(id)?.subject === subject,
  );
  const answeredIds = subjectQuestionIds.filter((id) => session.answers[id]);
  const wrongIds = answeredIds.filter((id) => !session.answers[id].correct);
  const correctCount = answeredIds.length - wrongIds.length;
  const accuracy = answeredIds.length
    ? Math.round((correctCount / answeredIds.length) * 100)
    : 0;

  return (
    <div className={styles.completionArea}>
      <section className={styles.completed}>
        <IconTrophy size={49} stroke={1.7} aria-hidden="true" />
        <span className={styles.eyebrow}>{failed ? 'DAILY STOP' : 'DAILY CLEAR'}</span>
        <h3>{subjectShortName(subject)}今日挑戰{failed ? '結束' : '完成'}</h3>
        <p>完成 {answeredIds.length} 題，答對 {correctCount} 題、答錯 {wrongIds.length} 題。</p>
        <strong>{accuracy}% 正確率</strong>
        <div className={styles.completionActions}>
          <Button onClick={onSelectSubjects}>選擇其他科目</Button>
        </div>
      </section>

      <section className={styles.completionReview} aria-labelledby="daily-completion-review">
        <header>
          <div>
            <span>WRONG ANSWERS</span>
            <h3 id="daily-completion-review">本次錯題整理</h3>
          </div>
          <strong>{wrongIds.length} 題</strong>
        </header>
        {wrongIds.length ? (
          <div className={styles.completionWrongList}>
            {wrongIds.map((questionId) => {
              const question = questionById.get(questionId);
              const answer = session.answers[questionId];
              if (!question || !answer) return null;
              const displayedQuestion = applyDailyOptionOrder(
                question,
                session.optionOrders[questionId],
              );
              return (
                <article key={questionId}>
                  <div className={styles.questionMeta}>
                    <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                  </div>
                  <QuestionPrompt question={question} compact />
                  <QuestionAnswerPanel
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                    showStatusLabels
                  />
                  <div className={styles.explanation}>
                    <strong>正確答案：{formatCorrectAnswer(displayedQuestion)}</strong>
                    <p>{question.explanation?.trim() || '本題目前尚無詳解，請比較正確選項與題幹條件。'}</p>
                  </div>
                  <div className={styles.noteEditor}>
                    <ReviewNoteEditor question={displayedQuestion} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.noWrong}>本次全數答對，沒有需要再次檢討的題目。</p>
        )}
      </section>
    </div>
  );
}

export function DailyPage() {
  const ready = useClientReady();
  const { state, dispatch, reportPersistence } = useAppState();
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectId[]>(['law']);
  const [completionRecord, setCompletionRecord] = useState<DailyCompletionRecord>({
    date: getTaipeiDateKey(),
    subjects: [],
    results: {},
  });
  const [session, setSession] = useState<DailyPracticeSession | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<{
    questionId: string;
    selected: number;
  }>();
  const [restored, setRestored] = useState(false);
  const [today, setToday] = useState(getTaipeiDateKey);
  const bank = useSubjectQuestions(session?.subjects ?? selectedSubjects);

  useEffect(() => {
    if (!ready || restored) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const storedSession = parseDailyPracticeSession(
        readStoredValue(DAILY_PRACTICE_STORAGE_KEY),
        today,
      );
      const storedCompletions = parseDailyCompletionRecord(
        readStoredValue(DAILY_COMPLETION_STORAGE_KEY),
        today,
      );
      let normalizedCompletions = storedCompletions;
      const storedSubject = storedSession?.subjects[0];
      if (storedSession && storedSubject) {
        if (storedSession.status === 'completed' || storedSession.status === 'failed') {
          normalizedCompletions = {
            date: storedCompletions.date,
            subjects: [...new Set([...storedCompletions.subjects, storedSubject])],
            results: {
              ...storedCompletions.results,
              [storedSubject]: createDailyCompletionResult(
                storedSession.answers,
                storedSession.status,
              ),
            },
          };
        } else if (storedCompletions.subjects.includes(storedSubject)) {
          const results = { ...storedCompletions.results };
          delete results[storedSubject];
          normalizedCompletions = {
            date: storedCompletions.date,
            subjects: storedCompletions.subjects.filter(
              (subject) => subject !== storedSubject,
            ),
            results,
          };
        }
      }
      setCompletionRecord(normalizedCompletions);
      if (storedSession) {
        setSession(storedSession);
        setSelectedSubjects(storedSession.subjects);
      } else {
        const firstAvailable = subjects.find(
          (subject) => !storedCompletions.subjects.includes(subject.id),
        );
        setSelectedSubjects(firstAvailable ? [firstAvailable.id] : []);
      }
      setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [ready, restored, today]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextDate = getTaipeiDateKey();
      removeStoredSession();
      setSession(null);
      setDraftAnswer(undefined);
      setCompletionRecord({ date: nextDate, subjects: [], results: {} });
      setSelectedSubjects(['law']);
      setToday(nextDate);
    }, getMillisecondsUntilTaipeiMidnight() + 250);
    return () => window.clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    if (!session) return;
    reportPersistence(
      'daily-practice',
      writeStoredValue(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session)),
    );
  }, [reportPersistence, session]);

  useEffect(() => {
    if (!restored) return;
    reportPersistence(
      'daily-completions',
      writeStoredValue(
        DAILY_COMPLETION_STORAGE_KEY,
        JSON.stringify(completionRecord),
      ),
    );
  }, [completionRecord, reportPersistence, restored]);

  const questionById = useMemo(
    () => new Map(bank.questions.map((question) => [question.id, question])),
    [bank.questions],
  );
  const currentQuestionId = session?.questionIds[session.currentIndex];
  const sourceCurrentQuestion = currentQuestionId
    ? questionById.get(currentQuestionId)
    : undefined;
  const currentQuestion = sourceCurrentQuestion && session
    ? applyDailyOptionOrder(
        sourceCurrentQuestion,
        session.optionOrders[sourceCurrentQuestion.id],
      )
    : undefined;
  const currentAnswer = currentQuestionId
    ? session?.answers[currentQuestionId]
    : undefined;
  let selectedOption = currentAnswer?.selected;
  if (
    selectedOption === undefined &&
    draftAnswer &&
    draftAnswer.questionId === currentQuestionId
  ) {
    selectedOption = draftAnswer.selected;
  }

  function toggleSubject(subject: SubjectId) {
    if (completionRecord.subjects.includes(subject)) return;
    setSelectedSubjects([subject]);
  }

  function startPractice() {
    const availableSubjects = selectedSubjects.filter(
      (subject) => !completionRecord.subjects.includes(subject),
    );
    const next = createDailyPracticeSession(bank.questions, availableSubjects);
    if (next.questionIds.length) setSession(next);
  }

  function markSubjectCompleted(
    subject: SubjectId,
    answers: DailyPracticeSession['answers'],
    status: DailyCompletionResult['status'],
  ) {
    setCompletionRecord((current) => ({
      date: current.date,
      subjects: [...new Set([...current.subjects, subject])],
      results: {
        ...current.results,
        [subject]: createDailyCompletionResult(answers, status),
      },
    }));
  }

  function answerQuestion() {
    if (!session || !currentQuestion || selectedOption === undefined || currentAnswer) return;
    const correct = isQuestionCorrect(currentQuestion, selectedOption);
    dispatch({
      type: 'save-answer',
      questionId: currentQuestion.id,
      selected: session.optionOrders[currentQuestion.id]?.[selectedOption] ?? selectedOption,
      correct,
      answeredAt: new Date().toISOString(),
    });
    const nextWrongIds = correct
      ? session.unreviewedWrongIds
      : [...new Set([...session.unreviewedWrongIds, currentQuestion.id])];
    const nextAnswers = {
      ...session.answers,
      [currentQuestion.id]: { selected: selectedOption, correct },
    };
    const failed = nextWrongIds.length >= DAILY_WRONG_LIMIT;
    if (failed) markSubjectCompleted(currentQuestion.subject, nextAnswers, 'failed');
    setSession({
      ...session,
      answers: nextAnswers,
      unreviewedWrongIds: nextWrongIds,
      currentIndex: failed ? session.currentIndex + 1 : session.currentIndex,
      status: failed ? 'failed' : session.status,
    });
  }

  function toggleEliminatedOption(option: number) {
    if (!session || !currentQuestionId || currentAnswer) return;
    const current = session.eliminatedOptions[currentQuestionId] ?? [];
    setSession({
      ...session,
      eliminatedOptions: {
        ...session.eliminatedOptions,
        [currentQuestionId]: current.includes(option)
          ? current.filter((index) => index !== option)
          : [...current, option],
      },
    });
  }

  function continuePractice() {
    if (!session || !currentAnswer) return;
    const nextIndex = Math.min(session.currentIndex + 1, session.questionIds.length);
    const enterReview = shouldEnterDailyReview(
      nextIndex,
      session.questionIds.length,
      session.unreviewedWrongIds.length,
    );
    const completed = nextIndex >= session.questionIds.length;
    if (!enterReview && completed) {
      markSubjectCompleted(session.subjects[0], session.answers, 'completed');
    }
    setSession({
      ...session,
      currentIndex: nextIndex,
      status: enterReview
        ? 'review'
        : completed
          ? 'completed'
          : 'practice',
    });
  }

  function markReviewed(questionId: string) {
    if (!session) return;
    setSession({
      ...session,
      reviewedWrongIds: [...new Set([...session.reviewedWrongIds, questionId])],
    });
  }

  function finishReview() {
    if (!session) return;
    const allReviewed = session.unreviewedWrongIds.every((id) =>
      session.reviewedWrongIds.includes(id),
    );
    if (!allReviewed) return;
    const completed = session.currentIndex >= session.questionIds.length;
    if (completed) {
      markSubjectCompleted(session.subjects[0], session.answers, 'completed');
    }
    setSession({
      ...session,
      unreviewedWrongIds: [],
      reviewedWrongIds: [],
      status: completed ? 'completed' : 'practice',
    });
  }

  function returnToSelection(confirmReset = false) {
    if (
      confirmReset &&
      !window.confirm('確定要清除目前尚未完成的闖關進度並重新選科嗎？')
    ) {
      return;
    }
    removeStoredSession();
    setSession(null);
    setDraftAnswer(undefined);
    const firstAvailable = subjects.find(
      (subject) => !completionRecord.subjects.includes(subject.id),
    );
    setSelectedSubjects(firstAvailable ? [firstAvailable.id] : []);
  }

  if (!ready || !restored) {
    return (
      <div className={styles.loading}>
        <IconLoader2 size={26} /><span>正在讀取今日進度…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <DailySetup
        selectedSubjects={selectedSubjects}
        completedSubjects={completionRecord.subjects}
        completionResults={completionRecord.results}
        onToggleSubject={toggleSubject}
        onStart={startPractice}
        questions={bank.questions}
        loading={bank.status === 'loading'}
        loadFailed={bank.status === 'error'}
        onRetry={bank.retry}
      />
    );
  }

  const completedSubject = session.subjects[0];
  const focusSubject = session.subjects[0];
  const reviewReady = session.unreviewedWrongIds.every((id) =>
    session.reviewedWrongIds.includes(id),
  );
  const missingReviewQuestion = session.status === 'review' &&
    session.unreviewedWrongIds.some((id) => !questionById.has(id));
  const requiredQuestionMissing =
    (session.status === 'practice' && Boolean(currentQuestionId) && !currentQuestion) ||
    missingReviewQuestion;
  const currentSubjectQuestionIndex = currentQuestion
    ? session.questionIds
        .slice(0, session.currentIndex)
        .filter((id) => questionById.get(id)?.subject === currentQuestion.subject)
        .length
    : 0;
  return (
    <section className={styles.daily}>
      {focusSubject ? (
        <ProgressOverview
          session={session}
          questionById={questionById}
          subject={focusSubject}
          onReset={() => returnToSelection(true)}
        />
      ) : null}

      {bank.status === 'loading' || (requiredQuestionMissing && bank.status !== 'error') ? (
        <div className={styles.loading}><IconLoader2 size={26} /><span>正在載入今日題目…</span></div>
      ) : bank.status === 'error' && requiredQuestionMissing ? (
        <div className={styles.loading} role="alert">
          <IconAlertTriangle size={26} />
          <span>目前題目載入失敗，進度已保存。</span>
          <Button onClick={bank.retry}>重新載入</Button>
        </div>
      ) : session.status === 'review' ? (
        <section className={styles.review} aria-labelledby="daily-review-title">
          <header>
            <IconShieldX size={30} aria-hidden="true" />
            <div>
              <span>CHECKPOINT</span>
              <h3 id="daily-review-title">先完成錯題檢討</h3>
              <p>確認每題錯誤原因後，才能繼續下一段挑戰。</p>
            </div>
          </header>
          <div className={styles.reviewList}>
            {session.unreviewedWrongIds.map((questionId) => {
              const question = questionById.get(questionId);
              const answer = session.answers[questionId];
              if (!question || !answer) return null;
              const displayedQuestion = applyDailyOptionOrder(
                question,
                session.optionOrders[questionId],
              );
              const reviewed = session.reviewedWrongIds.includes(questionId);
              return (
                <article key={questionId} data-reviewed={reviewed || undefined}>
                  <div className={styles.questionMeta}>
                    <Tag tone="green">{subjectShortName(question.subject)}</Tag>
                    <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                  </div>
                  <QuestionPrompt question={question} compact />
                  <QuestionAnswerPanel
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                    showStatusLabels
                  />
                  <div className={styles.explanation}>
                    <strong>正確答案：{formatCorrectAnswer(displayedQuestion)}</strong>
                    <p>{question.explanation?.trim() || '本題目前尚無詳解，請比較正確選項與題幹條件。'}</p>
                  </div>
                  <div className={styles.noteEditor}>
                    <ReviewNoteEditor question={displayedQuestion} />
                  </div>
                  <Button
                    variant={reviewed ? 'secondary' : 'primary'}
                    disabled={reviewed}
                    onClick={() => markReviewed(questionId)}
                  >
                    <IconCircleCheck size={17} />
                    {reviewed ? '已完成檢討' : '我已理解錯誤原因'}
                  </Button>
                </article>
              );
            })}
          </div>
          <footer>
            <span>{session.reviewedWrongIds.length} / {session.unreviewedWrongIds.length} 題已檢討</span>
            <Button variant="primary" disabled={!reviewReady} onClick={finishReview}>
              繼續闖關
            </Button>
          </footer>
        </section>
      ) : (session.status === 'completed' || session.status === 'failed') && completedSubject ? (
        <CompletionSummary
          session={session}
          subject={completedSubject}
          questionById={questionById}
          failed={session.status === 'failed'}
          onSelectSubjects={() => returnToSelection(false)}
        />
      ) : currentQuestion ? (
        <article
          className={styles.challenge}
          data-result={currentAnswer ? (currentAnswer.correct ? 'correct' : 'wrong') : undefined}
        >
          <header>
            <div className={styles.questionMeta}>
              <Tag>本科第 {Math.floor(currentSubjectQuestionIndex / DAILY_LEVEL_SIZE) + 1} 層</Tag>
              <Tag tone="green">本層第 {(currentSubjectQuestionIndex % DAILY_LEVEL_SIZE) + 1} / {DAILY_LEVEL_SIZE} 題</Tag>
              <Tag tone="purple">{subjectShortName(currentQuestion.subject)}</Tag>
            </div>
            <div className={styles.challengeActions}>
              <DifficultButton
                active={state.difficultQuestionIds.includes(currentQuestion.id)}
                onClick={() => dispatch({
                  type: 'toggle-difficult',
                  questionId: currentQuestion.id,
                })}
              />
              <strong>{currentSubjectQuestionIndex + 1} / {DAILY_QUESTIONS_PER_SUBJECT}</strong>
            </div>
          </header>
          <QuestionPrompt question={currentQuestion} />
          <OptionGroup
            label={`每日練習第 ${currentSubjectQuestionIndex + 1} 題請選擇答案`}
            options={currentQuestion.options}
            value={selectedOption}
            disabled={Boolean(currentAnswer)}
            eliminatedValues={session.eliminatedOptions[currentQuestion.id] ?? []}
            onValueChange={(selected) =>
              setDraftAnswer({ questionId: currentQuestion.id, selected })
            }
            onToggleEliminated={toggleEliminatedOption}
          />
          {currentAnswer && !currentAnswer.correct ? (
            <div className={styles.answerResult} data-correct={currentAnswer.correct || undefined} role="status">
              <IconX size={22} />
              <div>
                <strong>答錯了，已加入本輪檢討</strong>
                <span>正確答案：{formatCorrectAnswer(currentQuestion)}</span>
              </div>
            </div>
          ) : null}
          <footer>
            <span>本層錯 {session.unreviewedWrongIds.length} 題；本層達 {DAILY_WRONG_LIMIT} 題時今日練習直接結束。</span>
            {currentAnswer ? (
              <Button variant="primary" onClick={continuePractice}>下一題</Button>
            ) : (
              <Button variant="primary" disabled={selectedOption === undefined} onClick={answerQuestion}>確認答案</Button>
            )}
          </footer>
        </article>
      ) : null}
    </section>
  );
}
