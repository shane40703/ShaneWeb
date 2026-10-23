import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconClock,
  IconFlag,
  IconLoader2,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { ReviewNoteEditor } from '@/components/attempt-review';
import { QuestionPrompt, Tag } from '@/components/content/content';
import { DifficultButton } from '@/components/difficult-button';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { Button, OptionGroup } from '@/components/ui/ui';
import { formatCorrectAnswer, formatDuration } from '@/lib/study';
import type { Question } from '@/lib/types';
import { getSubject } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import { PracticeExplanation } from './practice-explanation';
import {
  getPracticeCategories,
  practiceQuestionHref,
  summarizePractice,
  type PracticeSession,
  type PracticeTimer,
} from './practice-session';
import styles from './practice-page.module.css';

export type PracticeQuestionStatus = 'ready' | 'loading' | 'error' | 'missing';

/** Re-renders alone every second, instead of the whole question page. */
export function ElapsedClock({
  timer,
  savedSeconds,
}: {
  timer: PracticeTimer;
  savedSeconds: number;
}) {
  const running = useSyncExternalStore(timer.subscribe, timer.getSeconds, () => 0);
  const elapsed = formatDuration(savedSeconds + running);
  return (
    <span className={styles.timer} aria-label={`作答時間 ${elapsed}`}>
      <IconClock size={15} aria-hidden="true" />
      作答時間
      <strong>{elapsed}</strong>
    </span>
  );
}

export function PracticeQuiz({
  session,
  question,
  status,
  timer,
  onRetry,
  onSelect,
  onToggleEliminated,
  onConfirm,
  onGoTo,
  onSubmit,
  onAbandon,
}: {
  session: PracticeSession;
  /** The current question with the session's option order applied. */
  question: Question | undefined;
  status: PracticeQuestionStatus;
  timer: PracticeTimer;
  onRetry: () => void;
  onSelect: (selected: number) => void;
  onToggleEliminated: (option: number) => void;
  onConfirm: () => void;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
  onAbandon: () => void;
}) {
  const { state, dispatch } = useAppState();
  const verdictRef = useRef<HTMLDivElement>(null);
  const numbersRef = useRef<HTMLDivElement>(null);
  const focusVerdictFor = useRef<string | null>(null);
  const index = session.currentIndex;
  const total = session.questionIds.length;
  const questionId = session.questionIds[index];
  const answer = session.answers[questionId];
  const selected = answer ? answer.selected : session.drafts[questionId];
  const isLast = index === total - 1;
  const summary = summarizePractice(session);
  const subjectName = getSubject(session.subject)?.shortName ?? '';
  const scope = [
    subjectName,
    `${session.rangeStart}–${session.rangeEnd} 年`,
    session.category === 'all' ? '全部類別' : session.category,
  ].join('・');

  // The confirm button disappears with the answer, so focus moves to the
  // verdict; focusing also scrolls it out from under the sticky footer.
  useEffect(() => {
    if (!answer || focusVerdictFor.current !== questionId) return;
    focusVerdictFor.current = null;
    verdictRef.current?.focus();
  }, [answer, questionId]);

  // Keeps the current number visible inside the navigator's own scroll area.
  useEffect(() => {
    const container = numbersRef.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!container || !active) return;
    // The container is the links' offset parent (position: relative).
    const top = active.offsetTop;
    if (top < container.scrollTop) {
      container.scrollTop = top - 12;
    } else if (top + active.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = top + active.offsetHeight - container.clientHeight + 12;
    }
  }, [index]);

  function confirm() {
    focusVerdictFor.current = questionId;
    onConfirm();
  }

  return (
    <section className={styles.practice} aria-label="每日練習（新版）作答">
      <div className={styles.questionArea}>
        {status === 'loading' ? (
          <div className={styles.loading}>
            <IconLoader2 size={26} aria-hidden="true" />
            <span>正在載入題目…</span>
          </div>
        ) : status === 'error' ? (
          <div className={styles.loading} role="alert">
            <IconAlertTriangle size={26} aria-hidden="true" />
            <span>題目載入失敗，作答進度已保存。</span>
            <Button onClick={onRetry}>重新載入</Button>
          </div>
        ) : status === 'missing' || !question ? (
          <div className={styles.loading} role="alert">
            <IconAlertTriangle size={26} aria-hidden="true" />
            <span>找不到這一題的資料，可以跳到其他題目或直接交卷。</span>
            {!isLast ? <Button onClick={() => onGoTo(index + 1)}>下一題</Button> : null}
          </div>
        ) : (
          <article
            className={styles.challenge}
            data-result={answer ? (answer.correct ? 'correct' : 'wrong') : undefined}
          >
            <header>
              <div className={styles.questionMeta}>
                <Tag tone="green">
                  {question.year} 年・原題第 {question.questionNumber} 題
                </Tag>
                <Tag>{subjectName}</Tag>
                {getPracticeCategories(question).map((category) => (
                  <Tag tone="purple" key={category}>
                    {category}
                  </Tag>
                ))}
              </div>
              <div className={styles.challengeActions}>
                <DifficultButton
                  active={state.difficultQuestionIds.includes(question.id)}
                  onClick={() =>
                    dispatch({ type: 'toggle-difficult', questionId: question.id })
                  }
                />
                <strong aria-label={`第 ${index + 1} 題，共 ${total} 題`}>
                  {index + 1} / {total}
                </strong>
              </div>
            </header>
            <div className={styles.answerBody} role="region" aria-label="題目與選項">
              <div className={styles.prompt}>
                <QuestionPrompt question={question} />
              </div>
              <div className={styles.optionsArea}>
                <OptionGroup
                  label={`第 ${index + 1} 題請選擇答案`}
                  options={question.options}
                  value={selected}
                  disabled={Boolean(answer)}
                  eliminatedValues={session.eliminated[questionId] ?? []}
                  onValueChange={onSelect}
                  onToggleEliminated={onToggleEliminated}
                />
              </div>
              {answer ? (
                <div
                  ref={verdictRef}
                  className={styles.answerResult}
                  data-correct={answer.correct || undefined}
                  role="status"
                  tabIndex={-1}
                >
                  {answer.correct ? (
                    <IconCircleCheck size={22} aria-hidden="true" />
                  ) : (
                    <IconX size={22} aria-hidden="true" />
                  )}
                  <div>
                    <strong>{answer.correct ? '答對了' : '答錯了'}</strong>
                    <span>
                      正確答案：{formatCorrectAnswer(question)}・你的答案：
                      {String.fromCharCode(65 + answer.selected)}
                    </span>
                  </div>
                </div>
              ) : null}
              {answer ? (
                <div className={styles.instantExplanation}>
                  <PracticeExplanation
                    question={question}
                    selectedIndex={answer.selected}
                    showAnswers={false}
                  />
                  <div className={styles.noteEditor}>
                    <ReviewNoteEditor key={question.id} question={question} />
                  </div>
                </div>
              ) : null}
            </div>
            <footer>
              <ElapsedClock timer={timer} savedSeconds={summary.elapsedSeconds} />
              <div className={styles.navButtons}>
                <Button disabled={index === 0} onClick={() => onGoTo(index - 1)}>
                  <IconArrowLeft size={17} aria-hidden="true" /> 上一題
                </Button>
                {answer ? (
                  isLast ? (
                    <Button variant="primary" onClick={onSubmit}>
                      <IconFlag size={17} aria-hidden="true" /> 交卷
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => onGoTo(index + 1)}>
                      下一題 <IconArrowRight size={17} aria-hidden="true" />
                    </Button>
                  )
                ) : (
                  <>
                    {!isLast ? (
                      <Button
                        variant="ghost"
                        className={styles.skip}
                        onClick={() => onGoTo(index + 1)}
                      >
                        跳過
                      </Button>
                    ) : null}
                    <Button
                      variant="primary"
                      disabled={selected === undefined}
                      onClick={confirm}
                    >
                      確認答案
                    </Button>
                  </>
                )}
              </div>
            </footer>
          </article>
        )}
      </div>

      <aside className={styles.sidebar} aria-label="題組資訊">
        <section className={styles.progressCard} aria-label="作答進度">
          <header>
            <span>本次題組</span>
            <strong>{scope}</strong>
          </header>
          <div className={styles.scoreboard}>
            <span>
              <strong>{summary.answered}</strong> / {total}
              <small>已作答</small>
            </span>
            <span>
              <strong>{summary.correct}</strong>
              <small>答對</small>
            </span>
            <span data-danger={summary.wrong > 0 || undefined}>
              <strong>{summary.wrong}</strong>
              <small>答錯</small>
            </span>
          </div>
          <div className={styles.sideActions}>
            <Button variant="primary" onClick={onSubmit}>
              <IconFlag size={17} aria-hidden="true" /> 交卷
            </Button>
            <Button onClick={onAbandon}>
              <IconRefresh size={16} aria-hidden="true" /> 重新選科／設定
            </Button>
          </div>
        </section>

        <section className={styles.navigator} aria-label="題號導覽">
          <header>
            <h2>題號導覽</h2>
            <strong>
              {summary.answered}/{total}
            </strong>
          </header>
          <div className={styles.questionNumbers} ref={numbersRef}>
            <QuestionNumberGrid>
              {session.questionIds.map((id, position) => (
                <QuestionNumberButton
                  key={id}
                  href={practiceQuestionHref(position)}
                  ariaLabel={`前往第 ${position + 1} 題`}
                  active={position === index}
                  answered={Boolean(session.answers[id])}
                  wrong={session.answers[id]?.correct === false}
                  difficult={state.difficultQuestionIds.includes(id)}
                >
                  {position + 1}
                </QuestionNumberButton>
              ))}
            </QuestionNumberGrid>
          </div>
          <footer className={styles.navigatorLegend}>
            <span>
              <i data-tone="current" />
              目前題目
            </span>
            <span>
              <i data-tone="answered" />
              答對
            </span>
            <span>
              <i data-tone="wrong" />
              答錯
            </span>
            <span>
              <i data-tone="difficult" />
              難題
            </span>
          </footer>
        </section>
      </aside>
    </section>
  );
}
