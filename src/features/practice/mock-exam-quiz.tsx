import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconFlag,
  IconLoader2,
  IconPlayerPause,
} from '@tabler/icons-react';
import { QuestionPrompt, Tag } from '@/components/content/content';
import { DifficultButton } from '@/components/difficult-button';
import { QuestionMapDrawer } from '@/components/question-map-drawer';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
  QuestionSheetLegend,
} from '@/components/question-number-button';
import { Button, ConfirmDialog, OptionGroup } from '@/components/ui/ui';
import type { QuizProgressByQuestion } from './mock-exam-progress';
import type { Question } from '@/lib/types';
import { getSubject } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import {
  mockExamHref,
  mockExamQuestionId,
  summarizeMockExamDraft,
  type MockExamPaper,
} from './mock-exam';
import { ElapsedClock } from './practice-quiz';
import type { PracticeQuestionStatus } from './practice-quiz';
import { getPracticeCategories, type PracticeTimer } from './practice-session';
import styles from './practice-page.module.css';

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Where ↑ or ↓ moves the answer: from no answer, ↓ starts at the top and ↑ at the bottom.
 * Struck-out options are stepped over, and the ends stop instead of wrapping round, so a
 * press too many never jumps from D back to A. Undefined when there is nowhere to go.
 */
function stepOption(
  count: number,
  eliminated: readonly number[],
  from: number | undefined,
  step: 1 | -1,
) {
  let next = from === undefined ? (step > 0 ? 0 : count - 1) : from + step;
  for (; next >= 0 && next < count; next += step) {
    if (!eliminated.includes(next)) return next;
  }
  return undefined;
}

/** One question of a paper at a time, answered like the real exam: no verdict until 交卷. */
export function MockExamQuiz({
  paper,
  question,
  status,
  index,
  progress,
  timer,
  canSubmit,
  submitWarning,
  onRetry,
  onSelect,
  onToggleEliminated,
  onGoTo,
  onSubmit,
  onLeave,
}: {
  paper: MockExamPaper;
  question: Question | undefined;
  status: PracticeQuestionStatus;
  /** 0-based position in the paper. */
  index: number;
  progress: QuizProgressByQuestion;
  timer: PracticeTimer;
  /** Grading needs every question of the paper loaded. */
  canSubmit: boolean;
  /** Said before 交卷 while questions are blank; a finished paper goes straight in. */
  submitWarning: string | null;
  onRetry: () => void;
  onSelect: (selected: number | undefined) => void;
  onToggleEliminated: (option: number) => void;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
  onLeave: () => void;
}) {
  const { state, dispatch } = useAppState();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const numbersRef = useRef<HTMLDivElement>(null);
  const [checkingBlanks, setCheckingBlanks] = useState(false);
  const total = paper.questionCount;
  const ids = Array.from({ length: total }, (_, position) =>
    mockExamQuestionId(paper.subject, paper.year, position + 1),
  );
  const questionId = ids[index];
  const current = progress[questionId];
  const isLast = index === total - 1;
  const summary = summarizeMockExamDraft(progress, ids);
  const subjectName = getSubject(paper.subject)?.shortName ?? '';
  const difficultCount = ids.filter((id) =>
    state.difficultQuestionIds.includes(id),
  ).length;
  const blanks = ids.flatMap((id, position) =>
    progress[id]?.selected === undefined ? [position] : [],
  );
  // The next blank after this question, coming round from the start; never this one.
  const nextBlank = blanks.find((position) => position > index) ?? blanks[0];
  const otherBlank = nextBlank === index ? undefined : nextBlank;

  function sheetTile(id: string) {
    const selected = progress[id]?.selected;
    const answer =
      selected === undefined ? undefined : String.fromCharCode(65 + selected);
    return {
      sheet: true,
      answer,
      stateLabel: answer ? `已作答 ${answer}` : '未作答',
      difficult: state.difficultQuestionIds.includes(id),
    };
  }

  function requestSubmit() {
    if (submitWarning) setCheckingBlanks(true);
    else onSubmit();
  }

  // Keeps the current number visible inside the navigator's own scroll area.
  useEffect(() => {
    const container = numbersRef.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!container || !active) return;
    const top = active.offsetTop;
    if (top < container.scrollTop) {
      container.scrollTop = top - 12;
    } else if (top + active.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = top + active.offsetHeight - container.clientHeight + 12;
    }
  }, [index]);

  // Arriving, or a button that goes away (上一題 on the first question, 下一題 on the
  // last), leaves focus on the page; the shortcuts and the keyboard need it in the paper.
  useEffect(() => {
    const focused = document.activeElement;
    if (focused === document.body || focused?.matches(':disabled')) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [index, status, current?.selected]);

  // A focused option keeps its place when the question changes, where its ring would mark
  // an answer the new question does not have; the new question's heading takes focus.
  useEffect(() => {
    if (optionsRef.current?.contains(document.activeElement)) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [index]);

  /**
   * ↑↓ move the answer and ←→ change the question, wherever focus is in the paper. Caught
   * on the way in: on a focused option, the option list's own arrows would change the
   * answer on ←→ and come round from D to A.
   */
  function handleArrowKey(event: KeyboardEvent<HTMLElement>) {
    const target = event.target;
    if (!ARROW_KEYS.has(event.key) || !(target instanceof HTMLElement)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // A dialog over the paper, or a field to type in, keeps its own arrows.
    if (
      target.closest('[role="dialog"], [role="alertdialog"], input, textarea, select') ||
      target.isContentEditable
    ) {
      return;
    }
    // Not the page's either: a held key would scroll it once the first step is taken.
    event.preventDefault();
    event.stopPropagation();
    // One press, one step: holding → does not run through the paper.
    if (event.repeat) return;
    if (event.key === 'ArrowLeft') {
      if (index > 0) onGoTo(index - 1);
      return;
    }
    if (event.key === 'ArrowRight') {
      // On the last question too: 交卷 is only ever a button.
      if (!isLast) onGoTo(index + 1);
      return;
    }
    if (!question) return;
    const radios = Array.from(
      optionsRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
    );
    const focusedRadio = target.closest<HTMLElement>('[role="radio"]');
    const focusedIndex = focusedRadio ? radios.indexOf(focusedRadio) : -1;
    const next = stepOption(
      question.options.length,
      current?.eliminatedOptions ?? [],
      // From the option under focus, like any radio list; otherwise from the answer.
      focusedIndex >= 0 ? focusedIndex : current?.selected,
      event.key === 'ArrowDown' ? 1 : -1,
    );
    if (next === undefined) return;
    if (next !== current?.selected) onSelect(next);
    const radio = radios[next];
    // Focus on an option goes along, so a screen reader reads the new answer.
    if (focusedIndex >= 0) radio?.focus({ preventScroll: true });
    // The new answer in sight, clear of the sticky bars by the page's scroll padding.
    radio?.closest('label')?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
  }

  return (
    <section
      className={`${styles.practice} ${styles.paperQuiz}`}
      aria-label="歷屆試題模擬考作答"
      // Takes focus from a click anywhere in the paper, so the arrow keys never go quiet.
      tabIndex={-1}
      onKeyDownCapture={handleArrowKey}
    >
      <h2
        ref={headingRef}
        className={styles.visuallyHidden}
        tabIndex={-1}
        aria-live="polite"
        aria-atomic="true"
      >
        第 {index + 1} 題，共 {total} 題
      </h2>
      <div className={styles.questionArea}>
        {status === 'loading' ? (
          <div className={styles.loading}>
            <IconLoader2 size={26} aria-hidden="true" />
            <span>正在載入試卷…</span>
          </div>
        ) : status === 'error' ? (
          <div className={styles.loading} role="alert">
            <IconAlertTriangle size={26} aria-hidden="true" />
            <span>試卷載入失敗，作答進度已保存。</span>
            <Button onClick={onRetry}>重新載入</Button>
          </div>
        ) : status === 'missing' || !question ? (
          <div className={styles.loading} role="alert">
            <IconAlertTriangle size={26} aria-hidden="true" />
            <span>
              找不到這一題的資料，請重新整理頁面再試。可以先作答其他題目，整份試卷的題目都能顯示後才能交卷。
            </span>
            {!isLast ? <Button onClick={() => onGoTo(index + 1)}>下一題</Button> : null}
            {isLast && index > 0 ? (
              <Button onClick={() => onGoTo(index - 1)}>上一題</Button>
            ) : null}
          </div>
        ) : (
          <article className={styles.challenge}>
            <header>
              <div className={styles.questionMeta}>
                <Tag tone="green">
                  {paper.year} 年・第 {question.questionNumber} 題
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
              <div className={styles.optionsArea} ref={optionsRef}>
                <OptionGroup
                  label={`第 ${index + 1} 題請選擇答案`}
                  options={question.options}
                  value={current?.selected}
                  eliminatedValues={current?.eliminatedOptions ?? []}
                  onValueChange={onSelect}
                  onToggleEliminated={onToggleEliminated}
                />
              </div>
            </div>
            <footer>
              <ElapsedClock timer={timer} savedSeconds={summary.elapsedSeconds} />
              {/* Read out as 上 下 選答案・左 右 換題. */}
              <p className={styles.shortcutHint}>
                <kbd>
                  <IconArrowUp size={12} stroke={2} aria-hidden="true" />
                  <span className={styles.visuallyHidden}>上</span>
                </kbd>
                <kbd>
                  <IconArrowDown size={12} stroke={2} aria-hidden="true" />
                  <span className={styles.visuallyHidden}>下</span>
                </kbd>
                <span>選答案・</span>
                <kbd>
                  <IconArrowLeft size={12} stroke={2} aria-hidden="true" />
                  <span className={styles.visuallyHidden}>左</span>
                </kbd>
                <kbd>
                  <IconArrowRight size={12} stroke={2} aria-hidden="true" />
                  <span className={styles.visuallyHidden}>右</span>
                </kbd>
                <span>換題</span>
              </p>
              <div className={styles.navButtons}>
                <QuestionMapDrawer
                  triggerClassName={styles.mapTrigger}
                  current={index + 1}
                  total={total}
                  questions={ids.map((id, position) => ({
                    id,
                    questionNumber: position + 1,
                    ariaLabel: `前往第 ${position + 1} 題`,
                    ...sheetTile(id),
                  }))}
                  value={questionId}
                  onValueChange={(id) => onGoTo(ids.indexOf(id))}
                  footer={(close) => (
                    <>
                      <QuestionSheetLegend />
                      <div className={styles.mapSummary}>
                        <p>
                          已作答 <strong>{summary.answered}</strong>・未作答{' '}
                          <strong>{total - summary.answered}</strong>・難題{' '}
                          <strong>{difficultCount}</strong>
                        </p>
                        {otherBlank !== undefined ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              close();
                              onGoTo(otherBlank);
                            }}
                          >
                            下一個未作答
                          </Button>
                        ) : null}
                      </div>
                      <div className={styles.mapActions}>
                        <Button
                          onClick={() => {
                            close();
                            onLeave();
                          }}
                        >
                          <IconPlayerPause size={16} aria-hidden="true" />{' '}
                          先離開，保留進度
                        </Button>
                        <Button
                          variant="primary"
                          disabled={!canSubmit}
                          onClick={() => {
                            close();
                            requestSubmit();
                          }}
                        >
                          <IconFlag size={17} aria-hidden="true" /> 交卷
                        </Button>
                      </div>
                    </>
                  )}
                />
                <Button
                  disabled={index === 0}
                  aria-keyshortcuts="ArrowLeft"
                  onClick={() => onGoTo(index - 1)}
                >
                  <IconArrowLeft size={17} aria-hidden="true" /> 上一題
                </Button>
                {/* Keyed: reaching the last question must not turn the focused 下一題 into 交卷. */}
                {isLast ? (
                  <Button
                    key="submit"
                    variant="primary"
                    disabled={!canSubmit}
                    onClick={requestSubmit}
                  >
                    <IconFlag size={17} aria-hidden="true" /> 交卷
                  </Button>
                ) : (
                  <Button
                    key="next"
                    variant="primary"
                    aria-keyshortcuts="ArrowRight"
                    onClick={() => onGoTo(index + 1)}
                  >
                    下一題 <IconArrowRight size={17} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </footer>
          </article>
        )}
      </div>

      <aside className={styles.sidebar} aria-label="試卷資訊">
        <section className={styles.progressCard} aria-label="作答進度">
          <header>
            <span>本次試卷</span>
            <strong>
              {subjectName}・{paper.year} 年・{total} 題
            </strong>
          </header>
          <div className={styles.scoreboard}>
            <span>
              <strong>{summary.answered}</strong> / {total}
              <small>已作答</small>
            </span>
            <span>
              <strong>{total - summary.answered}</strong>
              <small>未作答</small>
            </span>
            <span>
              <strong>{difficultCount}</strong>
              <small>難題</small>
            </span>
          </div>
          <div className={styles.sideActions}>
            <Button disabled={!canSubmit} onClick={requestSubmit}>
              <IconFlag size={17} aria-hidden="true" /> 交卷
            </Button>
            <Button variant="ghost" onClick={onLeave}>
              <IconPlayerPause size={16} aria-hidden="true" /> 先離開，保留進度
            </Button>
          </div>
        </section>

        <section className={styles.navigator} aria-label="題號導覽">
          <header>
            <h2>題號導覽</h2>
            {otherBlank !== undefined ? (
              <Button variant="ghost" onClick={() => onGoTo(otherBlank)}>
                下一個未作答
              </Button>
            ) : null}
          </header>
          <div className={styles.questionNumbers} ref={numbersRef}>
            <QuestionNumberGrid>
              {ids.map((id, position) => (
                <QuestionNumberButton
                  key={id}
                  href={mockExamHref({
                    subject: paper.subject,
                    year: paper.year,
                    q: position + 1,
                  })}
                  replace
                  shallow
                  ariaLabel={`前往第 ${position + 1} 題`}
                  active={position === index}
                  {...sheetTile(id)}
                >
                  {position + 1}
                </QuestionNumberButton>
              ))}
            </QuestionNumberGrid>
          </div>
          <div className={styles.navigatorLegend}>
            <QuestionSheetLegend />
          </div>
        </section>
      </aside>

      <ConfirmDialog
        open={checkingBlanks}
        onOpenChange={setCheckingBlanks}
        tone="warning"
        title="確定要交卷嗎？"
        description={submitWarning ?? ''}
        confirmLabel="確定交卷"
        cancelLabel="回去檢查"
        finalFocus={headingRef}
        onConfirm={onSubmit}
      >
        <div className={styles.blankNumbers}>
          <QuestionNumberGrid>
            {blanks.map((position) => (
              <QuestionNumberButton
                key={position}
                ariaLabel={`回到第 ${position + 1} 題`}
                active={position === index}
                sheet
                onClick={() => {
                  setCheckingBlanks(false);
                  onGoTo(position);
                }}
              >
                {position + 1}
              </QuestionNumberButton>
            ))}
          </QuestionNumberGrid>
        </div>
      </ConfirmDialog>
    </section>
  );
}
