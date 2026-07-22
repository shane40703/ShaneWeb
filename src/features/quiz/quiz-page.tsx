import Link from 'next/link';
import { useEffect, useReducer, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconExternalLink,
  IconX,
} from '@tabler/icons-react';
import {
  DifficultButton,
  EmptyState,
  PageHeader,
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import { Button, OptionGroup, ProgressBar } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import {
  formatDuration,
  getAcceptedAnswerIndexes,
  isQuestionCorrect,
} from '@/lib/study';
import type { Question, QuizAttempt } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import { quizProgressReducer } from './quiz-state';
import styles from './quiz-page.module.css';

export interface QuestionRouteItem {
  id: string;
  questionNumber: number;
  path: string;
}

export interface StaticQuestionPageProps {
  question: Question;
  paperQuestions: QuestionRouteItem[];
  position: number;
}

export function QuizPage({
  question,
  paperQuestions,
  position,
}: StaticQuestionPageProps) {
  const { state, dispatch } = useAppState();
  const [progressByQuestion, progressDispatch] = useReducer(quizProgressReducer, {});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const progress = progressByQuestion[question.id];
  const selected = progress?.selected;
  const submitted = progress?.submitted ?? false;
  const elapsedSeconds = progress?.elapsedSeconds ?? 0;
  const subject = getSubject(question.subject);
  const difficult = state.difficultQuestionIds.includes(question.id);
  const correct = submitted && isQuestionCorrect(question, selected);
  const acceptedAnswers = getAcceptedAnswerIndexes(question);
  const previous = paperQuestions[position - 1];
  const next = paperQuestions[position + 1];
  const answeredCount = paperQuestions.filter(
    (item) => progressByQuestion[item.id]?.submitted,
  ).length;

  useEffect(() => {
    const questionId = question.id;
    const startedAt = new Date().toISOString();
    progressDispatch({ type: 'visit-question', questionId, startedAt });
    if (submitted) return;
    const timer = window.setInterval(() => {
      progressDispatch({ type: 'tick-question', questionId, startedAt });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [question.id, submitted]);

  function submitAnswer() {
    if (submitted || (selected === undefined && question.answerKey.kind !== 'all-credit')) {
      return;
    }
    const startedAt = progress?.startedAt ?? new Date().toISOString();
    const answerIsCorrect = isQuestionCorrect(question, selected);
    if (selected !== undefined) {
      dispatch({
        type: 'save-answer',
        questionId: question.id,
        selected,
        correct: answerIsCorrect,
        answeredAt: new Date().toISOString(),
      });
    }
    progressDispatch({
      type: 'submit-question',
      questionId: question.id,
      startedAt,
      correct: answerIsCorrect,
    });
  }

  function submitQuiz() {
    if (attempt) return;

    const submittedAt = new Date().toISOString();
    const questionProgress = paperQuestions
      .map((item) => [item.id, progressByQuestion[item.id]] as const)
      .filter((entry) => entry[1]?.submitted);
    const answers = Object.fromEntries(
      questionProgress.flatMap(([questionId, item]) =>
        item?.selected === undefined ? [] : [[questionId, item.selected]],
      ),
    );
    const results = Object.fromEntries(
      questionProgress.map(([questionId, item]) => [questionId, item?.correct ?? false]),
    );
    const correctCount = questionProgress.filter(([, item]) => item?.correct).length;
    const unansweredCount = paperQuestions.length - questionProgress.length;
    const elapsedSeconds = questionProgress.reduce(
      (total, [, item]) => total + (item?.elapsedSeconds ?? 0),
      0,
    );
    const startedAt = questionProgress.reduce(
      (earliest, [, item]) =>
        item && item.startedAt < earliest ? item.startedAt : earliest,
      submittedAt,
    );
    const nextAttempt: QuizAttempt = {
      id: `attempt-${submittedAt}-${Math.random().toString(36).slice(2, 8)}`,
      mode: 'paper',
      subject: question.subject,
      year: question.year,
      questionIds: paperQuestions.map((item) => item.id),
      answers,
      startedAt,
      submittedAt,
      elapsedSeconds,
      correctCount,
      wrongCount: paperQuestions.length - correctCount - unansweredCount,
      unansweredCount,
    };

    dispatch({ type: 'save-attempt', attempt: nextAttempt, results });
    setAttempt(nextAttempt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (attempt) {
    const wrongQuestions = paperQuestions.filter(
      (item) => progressByQuestion[item.id]?.correct === false,
    );
    const score = paperQuestions.length
      ? Math.round((attempt.correctCount / paperQuestions.length) * 100)
      : 0;

    return (
      <>
        <PageHeader
          eyebrow="RESULT"
          title="本次作答結果"
          description={`總作答時間 ${formatDuration(attempt.elapsedSeconds)}`}
        />
        <section className={styles.resultCard}>
          <div className={styles.scoreRing} aria-label={`正確率 ${score}%`}>
            <strong>{score}%</strong>
            <span>正確率</span>
          </div>
          <div className={styles.resultStats}>
            <div data-tone="success"><strong>{attempt.correctCount}</strong><span>答對</span></div>
            <div data-tone="danger"><strong>{attempt.wrongCount}</strong><span>答錯</span></div>
            <div><strong>{attempt.unansweredCount}</strong><span>未作答</span></div>
            <div><strong>{formatDuration(attempt.elapsedSeconds)}</strong><span>總時間</span></div>
          </div>
          <div className={styles.resultActions}>
            <Button render={<Link href="/papers" />}>選擇其他試卷</Button>
            <Button variant="primary" render={<Link href="/history" />}>查看作答紀錄</Button>
          </div>
        </section>
        <section className={styles.reviewSection}>
          <h2>答錯題目</h2>
          {wrongQuestions.length ? (
            <div className={styles.reviewList}>
              {wrongQuestions.map((item) => (
                <Link key={item.id} href={item.path} onClick={() => setAttempt(null)}>
                  <span>第 {item.questionNumber} 題</span>
                  <strong>查看答案與詳解</strong>
                  <IconArrowRight size={18} stroke={2} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={IconCircleCheck}
              title="沒有答錯題目"
              description="這次作答沒有已作答但答錯的題目。"
            />
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="PAPER QUIZ"
        title={`${question.year} 年・${subject?.name}`}
        action={
          <div className={styles.timer}>
            <span>作答時間</span>
            <strong>{formatDuration(elapsedSeconds)}</strong>
          </div>
        }
      />
      <div className={styles.quizLayout}>
        <section className={styles.card}>
          <header className={styles.quizHeader}>
            <div className={styles.meta}>
              <Tag tone="green">{subject?.shortName}</Tag>
              <Tag>{question.year} 年</Tag>
              <Tag tone="orange">{question.primaryCategory}</Tag>
              <Tag tone={question.source.kind === 'official' ? 'green' : 'purple'}>
                {question.source.kind === 'official' ? '官方題' : '示範題'}
              </Tag>
            </div>
            <DifficultButton
              active={difficult}
              onClick={() => dispatch({ type: 'toggle-difficult', questionId: question.id })}
            />
          </header>
          <ProgressBar
            value={((position + 1) / paperQuestions.length) * 100}
            label="試卷進度"
          />
          <div className={styles.questionBody}>
            <span className={styles.questionNumber}>
              第 {question.questionNumber} 題・收錄題目 {position + 1}/{paperQuestions.length}
            </span>
            <QuestionPrompt question={question} />
            <QuestionSourceLine question={question} />
            <OptionGroup
              label="請選擇答案"
              options={question.options}
              value={selected}
              disabled={submitted}
              onValueChange={(value) =>
                progressDispatch({
                  type: 'select-answer',
                  questionId: question.id,
                  selected: value,
                  startedAt: new Date().toISOString(),
                })
              }
            />
            {!submitted ? (
              <Button
                variant="primary"
                onClick={submitAnswer}
                disabled={selected === undefined && question.answerKey.kind !== 'all-credit'}
              >
                送出答案
              </Button>
            ) : (
              <section className={styles.answerFeedback} data-correct={correct}>
                <header>
                  {correct ? (
                    <IconCircleCheck size={25} stroke={2.2} aria-hidden="true" />
                  ) : (
                    <IconX size={25} stroke={2.2} aria-hidden="true" />
                  )}
                  <strong>{correct ? '答對了' : '答案不正確'}</strong>
                </header>
                <p>
                  正確答案：
                  {question.answerKey.kind === 'all-credit'
                    ? '本題一律給分'
                    : acceptedAnswers
                        .map(
                          (index) =>
                            `${String.fromCharCode(65 + index)}・${question.options[index]}`,
                        )
                        .join('、')}
                </p>
                <p>{question.explanation ?? '目前尚無詳解。'}</p>
              </section>
            )}
            <Button
              variant="ghost"
              render={<Link href={`/community?question=${question.id}`} />}
            >
              前往詳解與討論 <IconExternalLink size={17} stroke={2} aria-hidden="true" />
            </Button>
          </div>
          <footer className={styles.navigation}>
            {previous ? (
              <Button render={<Link href={previous.path} />}>
                <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
              </Button>
            ) : (
              <Button disabled>
                <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
              </Button>
            )}
            <span>已作答 {answeredCount} / {paperQuestions.length}</span>
            {next ? (
              <Button variant="primary" render={<Link href={next.path} />}>
                下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
              </Button>
            ) : (
              <Button variant="primary" onClick={submitQuiz}>交卷</Button>
            )}
          </footer>
        </section>

        <aside className={styles.questionNavigator} aria-label="題號導覽">
          <header>
            <div>
              <span>STATIC PATHS</span>
              <h2>題號導覽</h2>
            </div>
            <strong>{position + 1}/{paperQuestions.length}</strong>
          </header>
          <div className={styles.questionNumbers}>
            {paperQuestions.map((item, index) => (
              <Link
                key={item.id}
                href={item.path}
                aria-current={index === position ? 'step' : undefined}
                aria-label={`前往第 ${item.questionNumber} 題`}
                data-answered={Boolean(
                  progressByQuestion[item.id]?.submitted,
                )}
              >
                {item.questionNumber}
              </Link>
            ))}
          </div>
          <footer className={styles.navigatorLegend}>
            <span><i data-tone="current" />目前題目</span>
            <span><i data-tone="answered" />已作答</span>
          </footer>
        </aside>
      </div>
    </>
  );
}
