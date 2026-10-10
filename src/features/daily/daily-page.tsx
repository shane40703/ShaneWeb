import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconCalendarClock,
  IconCircleCheck,
  IconClock,
  IconEraser,
  IconFlag3,
  IconHeart,
  IconLoader2,
  IconLock,
  IconRefresh,
  IconShieldCheck,
  IconShieldX,
  IconShieldPlus,
  IconSparkles,
  IconTargetArrow,
  IconTrophy,
  IconX,
} from '@tabler/icons-react';
import { DifficultButton } from '@/components/difficult-button';
import { ReviewNoteEditor } from '@/components/attempt-review';
import { AttachmentGallery } from '@/components/image-attachments';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { RichText } from '@/components/rich-text';
import { QuestionPrompt, Tag } from '@/components/content/content';
import { Button, OptionGroup } from '@/components/ui/ui';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import {
  formatCorrectAnswer,
  getAcceptedAnswerIndexes,
  isQuestionCorrect,
} from '@/lib/study';
import { useSharedDiscussions } from '@/lib/shared-discussions';
import { useClientReady } from '@/lib/use-client-ready';
import type { Question, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import {
  applyDailyOptionOrder,
  createDailyCompletionResult,
  createDailyPracticeSession,
  DAILY_BARRIER_SECONDS,
  DAILY_COMPLETION_STORAGE_KEY,
  DAILY_HEAL_STREAK,
  DAILY_PRACTICE_STORAGE_KEY,
  DAILY_QUESTION_SECONDS,
  DAILY_QUESTIONS_PER_SUBJECT,
  DAILY_RELIC_TYPES,
  DAILY_STAGES,
  getDailyLifeState,
  getDailyRelicInventory,
  getDailyRemainingTimeMs,
  getDailyStageBounds,
  getDailyStageIndex,
  getTaipeiDateKey,
  getMillisecondsUntilTaipeiMidnight,
  parseDailyCompletionRecord,
  parseDailyPracticeSession,
  shouldEnterDailyReview,
  type DailyCompletionRecord,
  type DailyCompletionResult,
  type DailyPracticeSession,
  type DailyRelicType,
} from './daily-practice';
import styles from './daily-page.module.css';

const relicLabels: Record<DailyRelicType, { name: string; description: string }> = {
  eliminate: { name: '破除', description: '自動刪除一個錯誤選項' },
  barrier: {
    name: '結界',
    description: `發動 ${DAILY_BARRIER_SECONDS} 秒防護罩，擋下魔王攻擊並延長倒數`,
  },
};

function RelicIcon({ type, size = 17 }: { type: DailyRelicType; size?: number }) {
  if (type === 'eliminate') return <IconEraser size={size} />;
  return <IconShieldCheck size={size} />;
}

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

function DailyExplanation({
  question,
  selectedIndex,
}: {
  question: Question;
  selectedIndex: number;
}) {
  const shared = useSharedDiscussions(question.id);
  const usefulPosts = shared.posts.filter((post) =>
    ['explanation', 'supplement', 'correction'].includes(post.type),
  );
  const hasBuiltInExplanation = Boolean(question.explanation?.trim());

  return (
    <section className={styles.explanation} aria-label={`第 ${question.questionNumber} 題詳解`}>
      <strong>正確答案：{formatCorrectAnswer(question)}</strong>
      {hasBuiltInExplanation ? (
        <p><RichText>{question.explanation!}</RichText></p>
      ) : null}
      {usefulPosts.map((post) => (
        <article key={post.id}>
          {post.content ? <p><RichText>{post.content}</RichText></p> : null}
          <AttachmentGallery images={post.images} />
        </article>
      ))}
      {shared.loading ? <p>正在載入詳解與討論…</p> : null}
      {!shared.loading && !hasBuiltInExplanation && !usefulPosts.length ? (
        <p>{shared.error || '本題目前尚無詳解，請比較正確選項與題幹條件。'}</p>
      ) : null}
      <span className={styles.answerSummary}>
        {selectedIndex >= 0
          ? `你的答案：${String.fromCharCode(65 + selectedIndex)}`
          : '你的答案：未作答（時間到）'}
      </span>
    </section>
  );
}

function DailyBattleScene({
  session,
  stageIndex,
  remainingTimeMs,
  barrierActive,
  answer,
  lifeState,
}: {
  session: DailyPracticeSession;
  stageIndex: number;
  remainingTimeMs: number;
  barrierActive: boolean;
  answer: DailyPracticeSession['answers'][string] | undefined;
  lifeState: ReturnType<typeof getDailyLifeState>;
}) {
  const stage = DAILY_STAGES[stageIndex];
  const { start, end } = getDailyStageBounds(stageIndex);
  const stageIds = session.questionIds.slice(start, end);
  const answered = stageIds.filter((id) => session.answers[id]).length;
  const bossDamage = stageIds.filter((id) =>
    session.answers[id]?.correct || session.reviewedWrongIds.includes(id),
  ).length;
  const victory = session.status === 'completed';
  const bossRemaining = victory ? 0 : Math.max(0, stage.questions - bossDamage);
  const defeated = bossRemaining === 0 && session.status !== 'failed';
  const remainingSeconds = Math.ceil(remainingTimeMs / 1000);
  const timerProgress = Math.min(
    100,
    (remainingTimeMs / (DAILY_QUESTION_SECONDS * 1000)) * 100,
  );

  return (
    <section
      className={styles.battleScene}
      data-stage={stageIndex + 1}
      data-result={answer ? (answer.correct ? 'correct' : 'wrong') : undefined}
      data-barrier={barrierActive || undefined}
      data-defeated={defeated || undefined}
      data-victory={victory || undefined}
      data-failed={session.status === 'failed' || undefined}
      aria-label={`第 ${stageIndex + 1} 層 ${stage.name}，對戰${stage.boss}`}
    >
      <header className={styles.battleHeading}>
        <span>STAGE {stageIndex + 1} / {DAILY_STAGES.length}</span>
        <strong>{stage.name}</strong>
        <small>{stageIndex === DAILY_STAGES.length - 1 ? 'FINAL BOSS' : 'BOSS BATTLE'}</small>
      </header>
      <div className={styles.pixelArena}>
        <span className={styles.scanlines} aria-hidden="true" />
        <div className={styles.heroActor} aria-label="建築師勇者">
          {barrierActive ? <i className={styles.barrierAura} /> : null}
        </div>
        {answer?.correct ? <b className={styles.hitCallout}>MEASURE HIT!</b> : null}
        {answer && !answer.correct ? <b className={styles.damageCallout}>COUNTER!</b> : null}
        {lifeState.streak >= 2 ? (
          <b className={styles.comboCallout}>{lifeState.streak} COMBO!</b>
        ) : null}
        <div className={styles.bossActor} data-boss={stageIndex + 1} aria-label={stage.boss} />
        {defeated && !victory ? (
          <strong className={styles.defeatBanner} role="status">魔王擊破！</strong>
        ) : null}
        {victory ? (
          <div className={styles.victoryScene} role="status" aria-label="六層挑戰勝利">
            <span className={styles.victoryStars} aria-hidden="true">✦ ✧ ✦ ✧ ✦</span>
            <IconTrophy size={32} aria-hidden="true" />
            <strong>VICTORY!</strong>
            <span>六層制霸・天際龍王擊破</span>
          </div>
        ) : null}
      </div>
      <footer className={styles.battleMeters}>
        <div
          className={styles.fighterMeter}
          aria-label={`建築師剩餘 ${lifeState.remaining} / ${lifeState.maximum} 點血量`}
        >
          <span><b>建築師</b><small>HP {lifeState.remaining} / {lifeState.maximum}</small></span>
          <i><b style={{ width: `${(lifeState.remaining / lifeState.maximum) * 100}%` }} /></i>
        </div>
        {session.status === 'practice' && !answer ? (
          <div
            className={styles.battleTimer}
            data-danger={remainingSeconds <= 10 || undefined}
            data-barrier={barrierActive || undefined}
            role="timer"
            aria-label={`本題剩餘 ${remainingSeconds} 秒`}
          >
            {barrierActive ? <IconShieldCheck size={18} /> : <IconClock size={18} />}
            <strong>{remainingSeconds}s</strong>
            <i style={{ '--timer-progress': `${timerProgress}%` } as CSSProperties} />
          </div>
        ) : (
          <div className={styles.turnCounter}>TURN {Math.min(answered, stage.questions)} / {stage.questions}</div>
        )}
        <div
          className={styles.fighterMeter}
          data-boss-meter
          aria-label={`${stage.boss}剩餘 ${bossRemaining} / ${stage.questions} 點血量`}
        >
          <span><b>{stage.boss}</b><small>HP {bossRemaining} / {stage.questions}</small></span>
          <i><b style={{ width: `${(bossRemaining / stage.questions) * 100}%` }} /></i>
        </div>
      </footer>
    </section>
  );
}

function DailySetup({
  selectedSubjects,
  completionResults,
  onToggleSubject,
  onStart,
  questions,
  loading,
  loadFailed,
  onRetry,
}: {
  selectedSubjects: SubjectId[];
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
          <h2 id="daily-practice-title">建築師的六層試煉</h2>
          <p>拿起捲尺，在 50 題內穿越六座建築戰場，擊敗從砌縫咕嚕到天際龍王的建築系魔王。</p>
        </div>
      </div>

      <div className={styles.rules} aria-label="每日練習規則">
        <div><strong>50</strong><span>每科題數</span></div>
        <div><strong>6</strong><span>建築戰場</span></div>
        <div><strong>3–4</strong><span>每層耐久</span></div>
        <div><strong>{DAILY_QUESTION_SECONDS}s</strong><span>每題限時</span></div>
        <p>各層題數 5／6／7／8／9／15；答錯會遭魔王反擊，連對 {DAILY_HEAL_STREAK} 題回復 1 格。倒數歸零立即戰敗，防護結界可擋攻並延長 {DAILY_BARRIER_SECONDS} 秒。</p>
      </div>

      <fieldset className={styles.subjectChoices}>
        <legend>選擇今日科目</legend>
        {subjects.map((subject) => {
          const checked = selectedSubjects.includes(subject.id);
          const result = completionResults[subject.id];
          return (
            <label
              key={subject.id}
              data-checked={checked || undefined}
              data-result={Boolean(result) || undefined}
            >
              <input
                type="radio"
                name="daily-subject"
                checked={checked}
                onChange={() => onToggleSubject(subject.id)}
              />
              <span>
                <strong>{subject.name}</strong>
                <small>
                  {result ? (
                    <>
                      <IconCalendarClock size={14} />
                      今日上次{result.status === 'failed' ? '挑戰結束' : '完成'}・答對 {result.correct} / {result.answered} 題，可再次挑戰
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
          ) : (
            <>請選擇今日要挑戰的科目。</>
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
  const wrong = answered.length - correct;
  const lifeState = getDailyLifeState(
    session.questionIds,
    session.answers,
    session.protectedWrongIds,
    Math.max(0, Math.min(session.currentIndex, session.questionIds.length - 1)),
  );
  const relicInventory = getDailyRelicInventory(
    session.questionIds,
    session.answers,
    session.relicUses,
    session.protectedWrongIds,
  );
  const relicCount = Object.values(relicInventory).reduce((sum, count) => sum + count, 0);
  const currentSubjectPosition = Math.min(
    questionIds.filter((id) => session.questionIds.indexOf(id) < session.currentIndex).length,
    Math.max(0, questionIds.length - 1),
  );
  const currentLevel = getDailyStageIndex(currentSubjectPosition);
  const subjectFinished = session.status === 'completed' || session.status === 'failed';

  return (
    <section className={styles.progressOverview} aria-label="每日練習進度與關卡">
      <ol className={styles.levelMap} aria-label={`${subjectShortName(subject)}關卡進度`}>
        {DAILY_STAGES.map((stage, index) => {
          const { start, end } = getDailyStageBounds(index);
          const levelQuestionIds = questionIds.slice(start, end);
          const complete = levelQuestionIds.length === stage.questions &&
            levelQuestionIds.every((id) => session.answers[id]);
          const active = !subjectFinished && index === currentLevel;
          return (
            <li
              key={index}
              data-complete={complete || undefined}
              data-active={active || undefined}
              data-boss
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
              <small>{stage.name}</small>
            </li>
          );
        })}
      </ol>
      <div className={styles.scoreboard} aria-label="每日練習統計">
        <span><strong>{answered.length}</strong> / {questionIds.length}<small>已作答</small></span>
        <span><strong>{correct}</strong><small>答對</small></span>
        <span>
          <strong>{wrong}</strong><small>累積答錯</small>
        </span>
        <span data-bonus={relicCount > 0 || undefined}>
          <strong><IconSparkles size={15} /> {relicCount}</strong>
          <small>寶具・連對 {lifeState.streak} / {DAILY_HEAL_STREAK}</small>
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
                    <Tag>{question.year} 年</Tag>
                    <Tag tone="green">{question.primaryCategory}</Tag>
                    <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                  </div>
                  <QuestionPrompt question={question} compact />
                  <QuestionAnswerPanel
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                    showStatusLabels
                  />
                  <DailyExplanation
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                  />
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
  const [nowMs, setNowMs] = useState(Date.now);
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
        }
      }
      setCompletionRecord(normalizedCompletions);
      if (storedSession) {
        setSession(storedSession);
        setSelectedSubjects(storedSession.subjects);
      } else {
        setSelectedSubjects(['law']);
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
  let selectedOption = currentAnswer && currentAnswer.selected >= 0
    ? currentAnswer.selected
    : undefined;
  if (
    selectedOption === undefined &&
    draftAnswer &&
    draftAnswer.questionId === currentQuestionId
  ) {
    selectedOption = draftAnswer.selected;
  }

  useEffect(() => {
    if (
      !session ||
      session.status !== 'practice' ||
      !currentQuestionId ||
      currentAnswer ||
      session.questionDeadlineMs
    ) {
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const startedAt = Date.now();
      setNowMs(startedAt);
      setSession((current) => current &&
        current.status === 'practice' &&
        current.questionIds[current.currentIndex] === currentQuestionId &&
        !current.answers[currentQuestionId] &&
        !current.questionDeadlineMs
          ? {
            ...current,
            questionDeadlineMs: startedAt + DAILY_QUESTION_SECONDS * 1000,
          }
        : current);
    });
    return () => {
      active = false;
    };
  }, [currentAnswer, currentQuestionId, session]);

  useEffect(() => {
    if (!session || session.status !== 'practice' || currentAnswer) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [currentAnswer, currentQuestionId, session]);

  useEffect(() => {
    if (
      !session ||
      session.status !== 'practice' ||
      !currentQuestionId ||
      currentAnswer ||
      !session.questionDeadlineMs
    ) {
      return;
    }
    const delay = Math.max(0, session.questionDeadlineMs - Date.now());
    const timeout = window.setTimeout(() => {
      setNowMs(Date.now());
      setSession((current) => {
        if (
          !current ||
          current.status !== 'practice' ||
          current.questionIds[current.currentIndex] !== currentQuestionId ||
          current.answers[currentQuestionId]
        ) {
          return current;
        }
        const nextAnswers = {
          ...current.answers,
          [currentQuestionId]: { selected: -1, correct: false, timedOut: true },
        };
        const nextWrongIds = [
          ...new Set([...current.unreviewedWrongIds, currentQuestionId]),
        ];
        return {
          ...current,
          answers: nextAnswers,
          unreviewedWrongIds: nextWrongIds,
          currentIndex: current.currentIndex + 1,
          status: 'failed',
          questionDeadlineMs: undefined,
          barrierUntilMs: undefined,
        };
      });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [currentAnswer, currentQuestionId, session]);

  useEffect(() => {
    if (!session || session.status !== 'failed') return;
    const subject = session.subjects[0];
    const result = createDailyCompletionResult(session.answers, 'failed');
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCompletionRecord((current) => {
        const existing = current.results[subject];
        if (
          current.subjects.includes(subject) &&
          existing?.answered === result.answered &&
          existing.correct === result.correct &&
          existing.status === result.status
        ) {
          return current;
        }
        return {
          date: current.date,
          subjects: [...new Set([...current.subjects, subject])],
          results: { ...current.results, [subject]: result },
        };
      });
    });
    return () => {
      active = false;
    };
  }, [session]);

  function toggleSubject(subject: SubjectId) {
    setSelectedSubjects([subject]);
  }

  function startPractice() {
    const next = createDailyPracticeSession(bank.questions, selectedSubjects);
    if (next.questionIds.length) {
      const startedAt = Date.now();
      setNowMs(startedAt);
      setSession({
        ...next,
        questionDeadlineMs: startedAt + DAILY_QUESTION_SECONDS * 1000,
      });
    }
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
    const barrierProtected = !correct && Boolean(
      session.barrierUntilMs && session.barrierUntilMs > nowMs,
    );
    const nextProtectedWrongIds = barrierProtected
      ? [...new Set([...session.protectedWrongIds, currentQuestion.id])]
      : session.protectedWrongIds;
    const nextLifeState = getDailyLifeState(
      session.questionIds,
      nextAnswers,
      nextProtectedWrongIds,
      session.currentIndex,
    );
    const failed = nextLifeState.failed;
    setSession({
      ...session,
      answers: nextAnswers,
      protectedWrongIds: nextProtectedWrongIds,
      unreviewedWrongIds: nextWrongIds,
      currentIndex: failed ? session.currentIndex + 1 : session.currentIndex,
      status: failed ? 'failed' : session.status,
      questionDeadlineMs: undefined,
      barrierUntilMs: session.barrierUntilMs && session.barrierUntilMs > nowMs
        ? session.barrierUntilMs
        : undefined,
    });
  }

  function activateRelic(type: DailyRelicType) {
    if (
      !session ||
      !currentQuestion ||
      !currentQuestionId ||
      currentAnswer ||
      session.relicUses[currentQuestionId] ||
      currentRelicInventory[type] <= 0
    ) {
      return;
    }
    const now = nowMs;
    const nextRelicUses = { ...session.relicUses, [currentQuestionId]: type };
    const nextSession: DailyPracticeSession = {
      ...session,
      relicUses: nextRelicUses,
    };

    if (type === 'eliminate') {
      const eliminated = session.eliminatedOptions[currentQuestionId] ?? [];
      const accepted = getAcceptedAnswerIndexes(currentQuestion);
      const target = currentQuestion.options.findIndex(
        (_, index) => !accepted.includes(index) && !eliminated.includes(index),
      );
      if (target < 0) return;
      nextSession.eliminatedOptions = {
        ...session.eliminatedOptions,
        [currentQuestionId]: [...eliminated, target],
      };
    } else if (type === 'barrier') {
      const deadline = Math.max(
        session.questionDeadlineMs ?? now + DAILY_QUESTION_SECONDS * 1000,
        now,
      );
      nextSession.questionDeadlineMs = deadline + DAILY_BARRIER_SECONDS * 1000;
      nextSession.barrierUntilMs = now + DAILY_BARRIER_SECONDS * 1000;
    }

    setNowMs(now);
    setSession(nextSession);
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
      questionDeadlineMs: enterReview || completed
        ? undefined
        : Date.now() + DAILY_QUESTION_SECONDS * 1000,
      barrierUntilMs: enterReview || completed ? undefined : session.barrierUntilMs,
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
      questionDeadlineMs: completed
        ? undefined
        : Date.now() + DAILY_QUESTION_SECONDS * 1000,
      barrierUntilMs: undefined,
    });
  }

  function returnToSelection(confirmReset = false) {
    if (
      confirmReset &&
      !window.confirm('確定要清除目前尚未完成的闖關進度並重新選科嗎？')
    ) {
      return;
    }
    const previousSubject = session?.subjects[0] ?? selectedSubjects[0] ?? 'law';
    removeStoredSession();
    setSession(null);
    setDraftAnswer(undefined);
    setSelectedSubjects([previousSubject]);
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
  const displayQuestionIndex = session.status === 'review' || session.status === 'completed'
    ? Math.max(0, session.currentIndex - 1)
    : Math.max(0, Math.min(session.currentIndex, session.questionIds.length - 1));
  const currentStageIndex = getDailyStageIndex(displayQuestionIndex);
  const currentStage = DAILY_STAGES[currentStageIndex];
  const currentStageBounds = getDailyStageBounds(currentStageIndex);
  const currentStageQuestionIndex = Math.max(
    0,
    Math.min(currentStage.questions - 1, session.currentIndex - currentStageBounds.start),
  );
  const currentLifeState = getDailyLifeState(
    session.questionIds,
    session.answers,
    session.protectedWrongIds,
    displayQuestionIndex,
  );
  const previousAnswers = currentQuestionId
    ? Object.fromEntries(
        Object.entries(session.answers).filter(([id]) => id !== currentQuestionId),
      )
    : session.answers;
  const previousLifeState = getDailyLifeState(
    session.questionIds,
    previousAnswers,
    session.protectedWrongIds.filter((id) => id !== currentQuestionId),
    displayQuestionIndex,
  );
  const completedHealStreak = Boolean(
    currentAnswer?.correct && previousLifeState.streak === DAILY_HEAL_STREAK - 1,
  );
  const restoredLife = completedHealStreak &&
    currentLifeState.remaining > previousLifeState.remaining;
  const relicRewardCount = Math.max(
    0,
    currentLifeState.relicsEarned - previousLifeState.relicsEarned,
  );
  const currentRelicInventory = getDailyRelicInventory(
    session.questionIds,
    session.answers,
    session.relicUses,
    session.protectedWrongIds,
  );
  const currentRelicUse = currentQuestionId
    ? session.relicUses[currentQuestionId]
    : undefined;
  const remainingTimeMs = getDailyRemainingTimeMs(
    session.questionDeadlineMs,
    nowMs,
  );
  const barrierActive = Boolean(
    session.barrierUntilMs && session.barrierUntilMs > nowMs,
  );
  const reviewLevel = getDailyStageIndex(Math.max(0, session.currentIndex - 1)) + 1;
  const reviewWrongCount = session.unreviewedWrongIds.length;
  const reviewRank = reviewWrongCount === 0 ? 'S' : reviewWrongCount === 1 ? 'A' : 'B';
  return (
    <section className={styles.daily}>
      <DailyBattleScene
        key={currentStageIndex}
        session={session}
        stageIndex={currentStageIndex}
        remainingTimeMs={remainingTimeMs}
        barrierActive={barrierActive}
        answer={currentAnswer}
        lifeState={currentLifeState}
      />
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
              <span>STAGE {reviewLevel} CLEAR・{DAILY_STAGES[reviewLevel - 1].boss}</span>
              <h3 id="daily-review-title">
                {reviewWrongCount ? '完成錯題檢討再前進' : '無傷通關！'}
              </h3>
              <p>{reviewWrongCount
                ? '確認每題錯誤原因後，補上最後攻擊才能擊敗魔王。'
                : '本層全數答對，獲得額外寶具獎勵。'}</p>
            </div>
            <strong className={styles.stageRank} aria-label={`本層評級 ${reviewRank}`}>
              {reviewRank}
            </strong>
          </header>
          {!reviewWrongCount ? (
            <div className={styles.flawlessReward} role="status">
              <IconSparkles size={28} />
              <div>
                <strong>PERFECT CLEAR・寶具 +1</strong>
                <span>無傷突破第 {reviewLevel} 層，獎勵已放入寶具列。</span>
              </div>
            </div>
          ) : null}
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
                    <Tag>{question.year} 年</Tag>
                    <Tag tone="green">{subjectShortName(question.subject)}</Tag>
                    <Tag>{question.primaryCategory}</Tag>
                    <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                  </div>
                  <QuestionPrompt question={question} compact />
                  <QuestionAnswerPanel
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                    showStatusLabels
                  />
                  <DailyExplanation
                    question={displayedQuestion}
                    selectedIndex={answer.selected}
                  />
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
              <Tag>本科第 {currentStageIndex + 1} 層・{currentStage.name}</Tag>
              <Tag tone="green">本層第 {currentStageQuestionIndex + 1} / {currentStage.questions} 題</Tag>
              <Tag>{subjectShortName(currentQuestion.subject)}</Tag>
              <Tag tone="purple">{currentQuestion.primaryCategory}</Tag>
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
          <section className={styles.relicDock} aria-label="本題寶具">
            <div>
              <span>RELIC DECK</span>
              <small>{currentRelicUse
                ? `本題已使用：${relicLabels[currentRelicUse].name}`
                : '每題最多使用 1 個寶具'}</small>
            </div>
            {DAILY_RELIC_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                title={relicLabels[type].description}
                aria-label={`${relicLabels[type].name}：${relicLabels[type].description}，持有 ${currentRelicInventory[type]} 個`}
                aria-pressed={currentRelicUse === type}
                disabled={Boolean(currentAnswer || currentRelicUse || currentRelicInventory[type] <= 0)}
                onClick={() => activateRelic(type)}
              >
                <RelicIcon type={type} />
                <span>{relicLabels[type].name}</span>
                <b>×{currentRelicInventory[type]}</b>
              </button>
            ))}
          </section>
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
          {currentAnswer?.correct ? (
            <div className={styles.rewardBurst} aria-hidden="true">
              <IconSparkles size={22} />
              <strong>{relicRewardCount
                ? `寶具 +${relicRewardCount}`
                : completedHealStreak
                  ? restoredLife ? '血量 +1' : '血量已滿'
                : `連擊 ${currentLifeState.streak} / ${DAILY_HEAL_STREAK}`}</strong>
              <span>
                <IconShieldPlus size={16} />
                {relicRewardCount
                  ? '滿血連擊或無傷通關獎勵'
                  : completedHealStreak
                  ? `目前血量 ${currentLifeState.remaining} / ${currentLifeState.maximum}`
                  : `再答對 ${DAILY_HEAL_STREAK - currentLifeState.streak} 題回復血量`}
              </span>
            </div>
          ) : null}
          {currentAnswer && !currentAnswer.correct ? (
            <div className={styles.answerResult} data-correct={currentAnswer.correct || undefined} role="status">
              <IconX size={22} />
              <div>
                <strong>{currentAnswer.timedOut
                  ? '時間到，已加入本輪檢討'
                  : session.protectedWrongIds.includes(currentQuestion.id)
                    ? '結界擋下反擊，本題未扣血'
                    : '答錯了，魔王反擊造成 1 格傷害'}</strong>
                <span>正確答案：{formatCorrectAnswer(currentQuestion)}</span>
              </div>
            </div>
          ) : null}
          {currentAnswer ? (
            <div className={styles.instantExplanation}>
              <DailyExplanation
                question={currentQuestion}
                selectedIndex={currentAnswer.selected}
              />
            </div>
          ) : null}
          <footer>
            <span>
              <IconHeart size={15} /> {currentLifeState.remaining}/{currentLifeState.maximum}
              ・連對 {currentLifeState.streak}/{DAILY_HEAL_STREAK}
              ・本層評級 {reviewWrongCount === 0 ? 'S' : reviewRank}
            </span>
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
