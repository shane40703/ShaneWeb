import { useEffect, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconListSearch,
  IconLoader2,
  IconRotateClockwise,
  IconTrophy,
} from '@tabler/icons-react';
import { AttemptReview } from '@/components/attempt-review';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { ResultViewTabs, type ResultView } from '@/components/result-view-tabs';
import { Button } from '@/components/ui/ui';
import { WrongCategoryAnalysis } from '@/components/wrong-category-analysis';
import { formatDuration, isQuestionCorrect } from '@/lib/study';
import type { Question, QuizAttempt } from '@/lib/types';
import { getSubject } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import {
  countMockExamBlanks,
  formatMockExamScore,
  getMockExamScore,
  type MockExamPaper,
} from './mock-exam';
import type { PracticeQuestionStatus } from './practice-quiz';
import styles from './practice-page.module.css';
import examStyles from './mock-exam.module.css';

const ANCHOR_PREFIX = 'result-question';

/** A submitted paper, read back from 已作答紀錄 so a reload or Back still finds it. */
export function MockExamResult({
  paper,
  attempt,
  questions,
  status,
  onRetry,
  onRetake,
  onChooseAnother,
}: {
  paper: MockExamPaper;
  attempt: QuizAttempt;
  questions: readonly Question[];
  status: PracticeQuestionStatus;
  onRetry: () => void;
  onRetake: () => void;
  onChooseAnother: () => void;
}) {
  const { state } = useAppState();
  const [view, setView] = useState<ResultView>('review');
  const [visibleId, setVisibleId] = useState<string>();
  const numbersRef = useRef<HTMLDivElement>(null);
  const subjectName = getSubject(paper.subject)?.shortName ?? '';
  const { score, maximumScore } = getMockExamScore(attempt, paper.subject);
  const total = attempt.questionIds.length;
  const { blank, free } = countMockExamBlanks(attempt);
  const reviewed = attempt.questionIds.flatMap((id) => {
    const question = questions.find((item) => item.id === id);
    return question ? [question] : [];
  });
  const activeId = visibleId ?? reviewed[0]?.id;

  // Follows the reading position, so the navigator marks the question in view.
  useEffect(() => {
    if (view !== 'review' || !reviewed.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top - 110) -
              Math.abs(right.boundingClientRect.top - 110),
          )[0];
        const id = visible?.target.getAttribute('data-question-id');
        if (id) setVisibleId(id);
      },
      { rootMargin: '-90px 0px -55% 0px', threshold: [0, 0.1] },
    );
    document
      .querySelectorAll<HTMLElement>(`[id^="${ANCHOR_PREFIX}-"][data-question-id]`)
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [reviewed.length, view]);

  // Keeps the number of the question in view visible inside the map's own scroll area.
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
  }, [activeId]);

  return (
    <div className={styles.resultArea}>
      <section className={styles.completed} aria-labelledby="mock-exam-result-title">
        <IconTrophy size={49} stroke={1.7} aria-hidden="true" />
        <span className={styles.eyebrow}>MOCK EXAM RESULT</span>
        <h2 id="mock-exam-result-title" className={examStyles.resultTitle}>
          {subjectName} {paper.year} 年模擬考結果
        </h2>
        <p>
          {!blank
            ? `共 ${total} 題，全部作答。`
            : `共 ${total} 題，作答 ${total - blank} 題，未作答 ${blank} 題${
                !free
                  ? '不給分'
                  : free === blank
                    ? '，一律給分，計入答對'
                    : `；其中 ${free} 題一律給分，計入答對，其餘不給分`
              }。`}
        </p>
        <strong className={styles.accuracy}>
          {formatMockExamScore(score)} 分／滿分 {maximumScore} 分
        </strong>
        <dl className={styles.resultStats}>
          <div>
            <dt>答對</dt>
            <dd>{attempt.correctCount}</dd>
          </div>
          <div data-tone="danger">
            <dt>答錯</dt>
            <dd>{attempt.wrongCount}</dd>
          </div>
          <div>
            <dt>未作答</dt>
            <dd>{blank}</dd>
          </div>
          <div>
            <dt>作答時間</dt>
            <dd>{formatDuration(attempt.elapsedSeconds)}</dd>
          </div>
        </dl>
        <div className={styles.completionActions}>
          <Button onClick={onRetake}>
            <IconRotateClockwise size={17} aria-hidden="true" /> 再考一次
          </Button>
          <Button variant="primary" onClick={onChooseAnother}>
            <IconListSearch size={17} aria-hidden="true" /> 選擇其他試卷
          </Button>
        </div>
      </section>

      {status === 'loading' ? (
        <div className={styles.loading}>
          <IconLoader2 size={26} aria-hidden="true" />
          <span>正在載入逐題結果…</span>
        </div>
      ) : reviewed.length < total ? (
        <div className={styles.loading} role="alert">
          <IconAlertTriangle size={26} aria-hidden="true" />
          <span>
            {status === 'error'
              ? '題目載入失敗，分數與作答紀錄仍保存在已作答紀錄。'
              : `尚有 ${total - reviewed.length} 題內容無法顯示。`}
          </span>
          {status === 'error' ? <Button onClick={onRetry}>重新載入</Button> : null}
        </div>
      ) : null}

      {reviewed.length ? (
        <section className={examStyles.review} aria-label="逐題作答結果">
          {attempt.wrongCount ? (
            <ResultViewTabs
              value={view}
              onValueChange={setView}
              idPrefix="mock-exam-result"
              ariaLabel="作答結果分頁"
            />
          ) : null}
          {view === 'wrong-analysis' && attempt.wrongCount ? (
            <div
              id="mock-exam-result-wrong-analysis-panel"
              role="tabpanel"
              aria-labelledby="mock-exam-result-wrong-analysis-tab"
            >
              <WrongCategoryAnalysis attempt={attempt} questions={reviewed} />
            </div>
          ) : (
            <div
              id="mock-exam-result-review-panel"
              role={attempt.wrongCount ? 'tabpanel' : undefined}
              aria-labelledby={
                attempt.wrongCount ? 'mock-exam-result-review-tab' : undefined
              }
              className={examStyles.reviewLayout}
            >
              <AttemptReview
                attempt={attempt}
                questions={reviewed}
                anchorPrefix={ANCHOR_PREFIX}
                showDifficultActions
              />
              <aside
                className={`${styles.navigator} ${examStyles.resultNavigator}`}
                aria-label="作答結果題號導覽"
              >
                <header>
                  <h2>題號導覽</h2>
                  <strong>
                    {attempt.correctCount}/{total}
                  </strong>
                </header>
                <div className={styles.questionNumbers} ref={numbersRef}>
                  <QuestionNumberGrid>
                    {reviewed.map((question) => {
                      const selected = attempt.answers[question.id];
                      return (
                        <QuestionNumberButton
                          key={question.id}
                          href={`#${ANCHOR_PREFIX}-${question.id}`}
                          replace
                          ariaLabel={`查看第 ${question.questionNumber} 題結果`}
                          stateLabel={
                            isQuestionCorrect(question, selected)
                              ? '答對'
                              : selected === undefined
                                ? '未作答'
                                : undefined
                          }
                          active={activeId === question.id}
                          // Green for every point scored, 一律給分 left blank included.
                          answered={isQuestionCorrect(question, selected)}
                          difficult={state.difficultQuestionIds.includes(question.id)}
                          wrong={
                            selected !== undefined &&
                            !isQuestionCorrect(question, selected)
                          }
                        >
                          {question.questionNumber}
                        </QuestionNumberButton>
                      );
                    })}
                  </QuestionNumberGrid>
                </div>
              </aside>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
