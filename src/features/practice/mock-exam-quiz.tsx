import { useEffect, useRef } from 'react';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconFlag,
  IconLoader2,
  IconPlayerPause,
} from '@tabler/icons-react';
import { QuestionPrompt, Tag } from '@/components/content/content';
import { DifficultButton } from '@/components/difficult-button';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { Button, OptionGroup } from '@/components/ui/ui';
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

/** One question of a paper at a time, answered like the real exam: no verdict until 交卷. */
export function MockExamQuiz({
  paper,
  question,
  status,
  index,
  progress,
  timer,
  canSubmit,
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
  onRetry: () => void;
  onSelect: (selected: number) => void;
  onToggleEliminated: (option: number) => void;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
  onLeave: () => void;
}) {
  const { state, dispatch } = useAppState();
  const numbersRef = useRef<HTMLDivElement>(null);
  const total = paper.questionCount;
  const ids = Array.from({ length: total }, (_, position) =>
    mockExamQuestionId(paper.subject, paper.year, position + 1),
  );
  const questionId = ids[index];
  const current = progress[questionId];
  const isLast = index === total - 1;
  const summary = summarizeMockExamDraft(progress, ids);
  const subjectName = getSubject(paper.subject)?.shortName ?? '';

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

  return (
    <section className={styles.practice} aria-label="歷屆試題模擬考作答">
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
              <div className={styles.optionsArea}>
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
              <div className={styles.navButtons}>
                <Button disabled={index === 0} onClick={() => onGoTo(index - 1)}>
                  <IconArrowLeft size={17} aria-hidden="true" /> 上一題
                </Button>
                {/* Keyed: reaching the last question must not turn the focused 下一題 into 交卷. */}
                {isLast ? (
                  <Button
                    key="submit"
                    variant="primary"
                    disabled={!canSubmit}
                    onClick={onSubmit}
                  >
                    <IconFlag size={17} aria-hidden="true" /> 交卷
                  </Button>
                ) : (
                  <Button key="next" variant="primary" onClick={() => onGoTo(index + 1)}>
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
              <strong>
                {ids.filter((id) => state.difficultQuestionIds.includes(id)).length}
              </strong>
              <small>難題</small>
            </span>
          </div>
          <div className={styles.sideActions}>
            <Button variant="primary" disabled={!canSubmit} onClick={onSubmit}>
              <IconFlag size={17} aria-hidden="true" /> 交卷
            </Button>
            <Button onClick={onLeave}>
              <IconPlayerPause size={16} aria-hidden="true" /> 先離開，保留進度
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
              {ids.map((id, position) => (
                <QuestionNumberButton
                  key={id}
                  href={mockExamHref({
                    subject: paper.subject,
                    year: paper.year,
                    q: position + 1,
                  })}
                  replace
                  ariaLabel={`前往第 ${position + 1} 題`}
                  stateLabel={progress[id]?.selected !== undefined ? '已作答' : '未作答'}
                  active={position === index}
                  answered={progress[id]?.selected !== undefined}
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
              已作答
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
