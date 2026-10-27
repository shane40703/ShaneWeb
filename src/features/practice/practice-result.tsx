import Link from 'next/link';
import { useState } from 'react';
import {
  IconListSearch,
  IconRotateClockwise,
  IconSparkles,
  IconTrophy,
} from '@tabler/icons-react';
import { ReviewNoteEditor } from '@/components/attempt-review';
import { QuestionPrompt, Tag } from '@/components/content/content';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { Button } from '@/components/ui/ui';
import { formatDuration } from '@/lib/study';
import type { Question } from '@/lib/types';
import { getSubject } from '@/question-bank/catalog';
import { PracticeExplanation } from './practice-explanation';
import { DAILY_PRACTICE_HISTORY_PATH } from './daily-practice-recording';
import {
  getDisplayedQuestion,
  getOriginalOptionIndexes,
  getPracticeCategories,
  type PracticeResult,
  type PracticeSession,
} from './practice-session';
import styles from './practice-page.module.css';

export function PracticeResultView({
  result,
  questionById,
  onRetry,
  onNewDraw,
  onSave,
  onSkip,
}: {
  result: PracticeResult;
  questionById: ReadonlyMap<string, Question>;
  onRetry: () => void;
  onNewDraw: () => void;
  onSave?: () => void;
  onSkip?: () => void;
}) {
  const { session, summary } = result;
  const subjectName = getSubject(session.subject)?.shortName ?? '';

  return (
    <div className={styles.resultArea}>
      <section className={styles.completed} aria-labelledby="practice-result-title">
        <IconTrophy size={49} stroke={1.7} aria-hidden="true" />
        <span className={styles.eyebrow}>PRACTICE RESULT</span>
        <h3 id="practice-result-title">{subjectName}練習結果</h3>
        <p>
          共 {summary.total} 題，作答 {summary.answered} 題
          {summary.unanswered ? `，未作答 ${summary.unanswered} 題不計入正確率` : ''}。
        </p>
        <strong className={styles.accuracy}>
          {summary.accuracy === null
            ? '這次沒有作答任何題目'
            : `${summary.accuracy}% 正確率`}
        </strong>
        <dl className={styles.resultStats}>
          <div>
            <dt>答對</dt>
            <dd>{summary.correct}</dd>
          </div>
          <div data-tone="danger">
            <dt>答錯</dt>
            <dd>{summary.wrong}</dd>
          </div>
          <div>
            <dt>未作答</dt>
            <dd>{summary.unanswered}</dd>
          </div>
          <div>
            <dt>作答時間</dt>
            <dd>{formatDuration(summary.elapsedSeconds)}</dd>
          </div>
        </dl>
        {result.recording ? <section className={styles.recordingChoice} aria-label="儲存每日練習履歷">
          <strong>{result.recording.status === 'saved' ? '已加入每日練習履歷' : '是否記錄此次作答？'}</strong>
          <p>{result.recording.status === 'saved'
            ? '此次題組、作答答案、正確率與時間已記錄，可在履歷查看或刪除。'
            : result.recording.status === 'skipped'
              ? '此次作答未加入履歷。若改變心意，可在離開或重新整理之前選擇儲存。'
              : '只有選擇儲存才會加入履歷及作答統計；不記錄仍可查看本次結果與詳解。離開或重新整理前未儲存，就不會加入履歷。'}</p>
          <div className={styles.completionActions}>
            {result.recording.status === 'saved'
              ? <Button role="link" render={<Link href={DAILY_PRACTICE_HISTORY_PATH} />}>查看每日練習履歷</Button>
              : <>
                <Button variant="primary" disabled={!onSave} onClick={onSave}>儲存此次作答</Button>
                {result.recording.status === 'pending'
                  ? <Button disabled={!onSkip} onClick={onSkip}>不記錄此次作答</Button> : null}
              </>}
          </div>
        </section> : null}
        <div className={styles.completionActions}>
          <Button onClick={onRetry}>
            <IconRotateClockwise size={17} aria-hidden="true" /> 重做這組題目
          </Button>
          <Button variant="primary" onClick={onNewDraw}>
            <IconSparkles size={17} aria-hidden="true" /> 重新選科／抽題
          </Button>
        </div>
      </section>

      <section className={styles.completionReview} aria-labelledby="practice-wrong-title">
        <header>
          <div>
            <span>WRONG ANSWERS</span>
            <h3 id="practice-wrong-title">本次錯題整理</h3>
          </div>
          <strong>{summary.wrong} 題</strong>
        </header>
        {summary.wrongIds.length ? (
          <div className={styles.completionWrongList}>
            {summary.wrongIds.map((questionId) => {
              const question = questionById.get(questionId);
              const answer = session.answers[questionId];
              if (!question || !answer) return null;
              const displayed = getDisplayedQuestion(session, question);
              return (
                <article key={questionId}>
                  <div className={styles.questionMeta}>
                    <Tag>{question.year} 年</Tag>
                    {getPracticeCategories(question).map((category) => (
                      <Tag tone="green" key={category}>
                        {category}
                      </Tag>
                    ))}
                    <Tag tone="purple">原題第 {question.questionNumber} 題</Tag>
                  </div>
                  <QuestionPrompt question={question} compact />
                  <QuestionAnswerPanel
                    question={displayed}
                    selectedIndex={answer.selected}
                    originalOptionIndexes={getOriginalOptionIndexes(question, session.optionOrders[questionId])}
                    showStatusLabels
                  />
                  <PracticeExplanation
                    question={displayed}
                    selectedIndex={answer.selected}
                  />
                  <div className={styles.noteEditor}>
                    <ReviewNoteEditor question={displayed} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.noWrong}>
            {summary.answered
              ? '作答的題目全部答對，沒有需要檢討的題目。'
              : '這次沒有作答任何題目。'}
          </p>
        )}
      </section>

      <PracticePaperPreview session={session} questionById={questionById} />
    </div>
  );
}

function PracticePaperPreview({
  session,
  questionById,
}: {
  session: PracticeSession;
  questionById: ReadonlyMap<string, Question>;
}) {
  const [open, setOpen] = useState(false);
  const ready = session.questionIds.every((questionId) => questionById.has(questionId));

  return (
    <section className={styles.previewPanel} aria-label="本次考題預覽工具">
      <header>
        <div>
          <strong>本次完整考題</strong>
          <small>
            {getSubject(session.subject)?.shortName}・共 {session.questionIds.length} 題
          </small>
        </div>
        <Button
          disabled={!ready}
          aria-expanded={open}
          aria-controls="practice-paper-preview"
          onClick={() => setOpen((value) => !value)}
        >
          <IconListSearch size={17} aria-hidden="true" />
          {open ? '收合本次考題' : '本次考題預覽'}
        </Button>
      </header>
      <p>
        練習已結束，可以展開本次完整考題；題目與選項順序和這次練習相同，不顯示答案或詳解。
      </p>
      {open && ready ? (
        <div
          id="practice-paper-preview"
          role="region"
          aria-label="本次考題預覽"
          className={styles.preview}
        >
          <ol>
            {session.questionIds.map((questionId, index) => {
              const question = getDisplayedQuestion(
                session,
                questionById.get(questionId)!,
              );
              return (
                <li key={questionId} data-question-id={questionId}>
                  <article>
                    <header>
                      <strong>第 {index + 1} 題</strong>
                      <span>
                        {question.year} 年・原題第 {question.questionNumber} 題
                      </span>
                    </header>
                    <QuestionPrompt question={question} compact />
                    <ol
                      className={styles.previewOptions}
                      aria-label={`第 ${index + 1} 題選項`}
                    >
                      {question.options.map((option, optionIndex) => (
                        <li key={optionIndex}>
                          <b>({String.fromCharCode(65 + optionIndex)})</b>
                          <span>{option}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
