import { useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle,
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
  createDailyPracticeSession,
  DAILY_LEVEL_SIZE,
  DAILY_PRACTICE_STORAGE_KEY,
  DAILY_QUESTIONS_PER_SUBJECT,
  DAILY_WRONG_LIMIT,
  parseDailyPracticeSession,
  shouldEnterDailyReview,
  type DailyPracticeSession,
} from './daily-practice';
import styles from './daily-page.module.css';

function DailySetup({
  selectedSubjects,
  onToggleSubject,
  onStart,
  questions,
  loading,
  loadFailed,
  onRetry,
}: {
  selectedSubjects: SubjectId[];
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
  const targetCount = selectedSubjects.length * DAILY_QUESTIONS_PER_SUBJECT;

  return (
    <section className={styles.setup} aria-labelledby="daily-practice-title">
      <div className={styles.hero}>
        <span className={styles.heroIcon} aria-hidden="true">
          <IconTargetArrow size={34} stroke={1.8} />
        </span>
        <div>
          <span className={styles.eyebrow}>DAILY CHALLENGE</span>
          <h2 id="daily-practice-title">每日 50 題闖關</h2>
          <p>每個選取科目各抽 50 題，每科十層，每層五題。</p>
        </div>
      </div>

      <div className={styles.rules} aria-label="每日練習規則">
        <div><strong>50</strong><span>每科題數</span></div>
        <div><strong>5</strong><span>每層題數</span></div>
        <div><strong>{DAILY_WRONG_LIMIT}</strong><span>錯題警戒</span></div>
        <p>每層結束需檢討該層錯題；累積錯 {DAILY_WRONG_LIMIT} 題會立即暫停並進入檢討。</p>
      </div>

      <fieldset className={styles.subjectChoices}>
        <legend>選擇今日科目（可複選）</legend>
        {subjects.map((subject) => {
          const checked = selectedSubjects.includes(subject.id);
          return (
            <label key={subject.id} data-checked={checked || undefined}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleSubject(subject.id)}
              />
              <span>
                <strong>{subject.name}</strong>
                <small>
                  {checked && !loading
                    ? `題庫 ${subjectCounts[subject.id] ?? 0} 題，今日抽 50 題`
                    : subject.description}
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
          ) : (
            <>已選 {selectedSubjects.length} 科・今日共 {targetCount} 題</>
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

function LevelMap({
  session,
  questionById,
}: {
  session: DailyPracticeSession;
  questionById: Map<string, Question>;
}) {
  const levelCount = Math.ceil(session.questionIds.length / DAILY_LEVEL_SIZE);
  const currentLevel = Math.min(
    Math.floor(session.currentIndex / DAILY_LEVEL_SIZE),
    Math.max(0, levelCount - 1),
  );
  const subjectLevelCounts = new Map<SubjectId, number>();

  return (
    <ol className={styles.levelMap} aria-label="每日練習關卡進度">
      {Array.from({ length: levelCount }, (_, index) => {
        const start = index * DAILY_LEVEL_SIZE;
        const levelQuestionIds = session.questionIds.slice(
          start,
          start + DAILY_LEVEL_SIZE,
        );
        const subject = questionById.get(levelQuestionIds[0])?.subject;
        const subjectLevel = subject
          ? (subjectLevelCounts.get(subject) ?? 0) + 1
          : index + 1;
        if (subject) subjectLevelCounts.set(subject, subjectLevel);
        const answered = levelQuestionIds.filter((id) => session.answers[id]).length;
        const complete = answered === levelQuestionIds.length;
        const active = session.status !== 'completed' && index === currentLevel;
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
                subjectLevel
              ) : (
                <IconLock size={14} />
              )}
            </span>
            <small>
              {subject
                ? subjects.find((item) => item.id === subject)?.shortName
                : '關卡'}{' '}
              {subjectLevel}
            </small>
          </li>
        );
      })}
    </ol>
  );
}

export function DailyPage() {
  const ready = useClientReady();
  const { dispatch, reportPersistence } = useAppState();
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectId[]>(['law']);
  const [session, setSession] = useState<DailyPracticeSession | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<{
    questionId: string;
    selected: number;
  }>();
  const [restored, setRestored] = useState(false);
  const bank = useSubjectQuestions(session?.subjects ?? selectedSubjects);

  useEffect(() => {
    if (!ready || restored) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const stored = parseDailyPracticeSession(
        readStoredValue(DAILY_PRACTICE_STORAGE_KEY),
      );
      if (stored) {
        setSession(stored);
        setSelectedSubjects(stored.subjects);
      }
      setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [ready, restored]);

  useEffect(() => {
    if (!session) return;
    reportPersistence(
      'daily-practice',
      writeStoredValue(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session)),
    );
  }, [reportPersistence, session]);

  const questionById = useMemo(
    () => new Map(bank.questions.map((question) => [question.id, question])),
    [bank.questions],
  );
  const currentQuestionId = session?.questionIds[session.currentIndex];
  const currentQuestion = currentQuestionId
    ? questionById.get(currentQuestionId)
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
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject],
    );
  }

  function startPractice() {
    const next = createDailyPracticeSession(bank.questions, selectedSubjects);
    if (next.questionIds.length) setSession(next);
  }

  function answerQuestion() {
    if (!session || !currentQuestion || selectedOption === undefined || currentAnswer) return;
    const correct = isQuestionCorrect(currentQuestion, selectedOption);
    dispatch({
      type: 'save-answer',
      questionId: currentQuestion.id,
      selected: selectedOption,
      correct,
      answeredAt: new Date().toISOString(),
    });
    setSession({
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: { selected: selectedOption, correct },
      },
      unreviewedWrongIds: correct
        ? session.unreviewedWrongIds
        : [...new Set([...session.unreviewedWrongIds, currentQuestion.id])],
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
    setSession({
      ...session,
      currentIndex: nextIndex,
      status: enterReview
        ? 'review'
        : nextIndex >= session.questionIds.length
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
    setSession({
      ...session,
      unreviewedWrongIds: [],
      reviewedWrongIds: [],
      status: session.currentIndex >= session.questionIds.length
        ? 'completed'
        : 'practice',
    });
  }

  function resetPractice() {
    if (!window.confirm('確定要清除今天的闖關進度並重新選科嗎？')) return;
    try {
      window.localStorage.removeItem(DAILY_PRACTICE_STORAGE_KEY);
    } catch {
      // The in-memory reset still works when private browsing blocks storage.
    }
    setSession(null);
    setDraftAnswer(undefined);
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
        onToggleSubject={toggleSubject}
        onStart={startPractice}
        questions={bank.questions}
        loading={bank.status === 'loading'}
        loadFailed={bank.status === 'error'}
        onRetry={bank.retry}
      />
    );
  }

  const answeredCount = Object.keys(session.answers).length;
  const correctCount = Object.values(session.answers).filter((answer) => answer.correct).length;
  const wrongCount = answeredCount - correctCount;
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
      <header className={styles.dashboard}>
        <div>
          <span className={styles.eyebrow}>TODAY&apos;S PROGRESS</span>
          <h2>每日練習</h2>
          <p>{session.subjects.map((id) => subjects.find((item) => item.id === id)?.shortName).join('・')}</p>
        </div>
        <div className={styles.scoreboard} aria-label="每日練習統計">
          <span><strong>{answeredCount}</strong> / {session.questionIds.length}<small>已作答</small></span>
          <span><strong>{correctCount}</strong><small>答對</small></span>
          <span data-danger={session.unreviewedWrongIds.length >= DAILY_WRONG_LIMIT || undefined}>
            <strong>{session.unreviewedWrongIds.length}</strong> / {DAILY_WRONG_LIMIT}<small>待檢討</small>
          </span>
        </div>
        <button type="button" className={styles.reset} onClick={resetPractice}>
          <IconRefresh size={16} /> 重新設定
        </button>
      </header>

      <LevelMap session={session} questionById={questionById} />

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
              const reviewed = session.reviewedWrongIds.includes(questionId);
              return (
                <article key={questionId} data-reviewed={reviewed || undefined}>
                  <div className={styles.questionMeta}>
                    <Tag>{question.year} 年</Tag>
                    <Tag tone="green">{subjects.find((item) => item.id === question.subject)?.shortName}</Tag>
                    <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                  </div>
                  <QuestionPrompt question={question} compact />
                  <QuestionAnswerPanel
                    question={question}
                    selectedIndex={answer.selected}
                    showStatusLabels
                  />
                  <div className={styles.explanation}>
                    <strong>正確答案：{formatCorrectAnswer(question)}</strong>
                    <p>{question.explanation?.trim() || '本題目前尚無詳解，請比較正確選項與題幹條件。'}</p>
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
              {session.currentIndex >= session.questionIds.length ? '完成今日練習' : '繼續闖關'}
            </Button>
          </footer>
        </section>
      ) : session.status === 'completed' ? (
        <section className={styles.completed}>
          <IconTrophy size={54} stroke={1.7} aria-hidden="true" />
          <span className={styles.eyebrow}>DAILY CLEAR</span>
          <h3>今日挑戰完成</h3>
          <p>完成 {answeredCount} 題，答對 {correctCount} 題、答錯 {wrongCount} 題。</p>
          <strong>{answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0}% 正確率</strong>
        </section>
      ) : currentQuestion ? (
        <article className={styles.challenge}>
          <header>
            <div className={styles.questionMeta}>
              <Tag>本科第 {Math.floor(currentSubjectQuestionIndex / DAILY_LEVEL_SIZE) + 1} 層</Tag>
              <Tag tone="green">本層第 {(currentSubjectQuestionIndex % DAILY_LEVEL_SIZE) + 1} / {DAILY_LEVEL_SIZE} 題</Tag>
              <Tag tone="purple">{subjects.find((item) => item.id === currentQuestion.subject)?.shortName}・{currentQuestion.year} 年</Tag>
            </div>
            <strong>{session.currentIndex + 1} / {session.questionIds.length}</strong>
          </header>
          <QuestionPrompt question={currentQuestion} />
          <OptionGroup
            label={`每日練習第 ${session.currentIndex + 1} 題請選擇答案`}
            options={currentQuestion.options}
            value={selectedOption}
            disabled={Boolean(currentAnswer)}
            onValueChange={(selected) =>
              setDraftAnswer({ questionId: currentQuestion.id, selected })
            }
          />
          {currentAnswer ? (
            <div className={styles.answerResult} data-correct={currentAnswer.correct || undefined} role="status">
              {currentAnswer.correct ? <IconCircleCheck size={22} /> : <IconX size={22} />}
              <div>
                <strong>{currentAnswer.correct ? '答對了，繼續前進！' : '答錯了，已加入本輪檢討'}</strong>
                {!currentAnswer.correct ? <span>正確答案：{formatCorrectAnswer(currentQuestion)}</span> : null}
              </div>
            </div>
          ) : null}
          <footer>
            <span>累積錯 {session.unreviewedWrongIds.length} 題；達 {DAILY_WRONG_LIMIT} 題立即進入檢討。</span>
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
