import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useReducer, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconCircleCheck,
  IconExternalLink,
  IconMessages,
  IconMinus,
  IconX,
} from '@tabler/icons-react';
import {
  DifficultButton,
  PageHeader,
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { Button, OptionGroup, ProgressBar } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import {
  calculateScore,
  formatDuration,
  formatCorrectAnswer,
  getQuestionDisplayCategory,
  isQuestionCorrect,
} from '@/lib/study';
import type { Question, QuizAttempt, QuizQuestion } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import { quizProgressReducer } from './quiz-state';
import styles from './quiz-page.module.css';

export interface StaticQuestionPageProps {
  question: Question;
  questionBank: QuizQuestion[];
}

export function QuizPage({
  question,
  questionBank,
}: StaticQuestionPageProps) {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const [progressByQuestion, progressDispatch] = useReducer(quizProgressReducer, {});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const progress = progressByQuestion[question.id];
  const selected = progress?.selected;
  const elapsedSeconds = progress?.elapsedSeconds ?? 0;
  const subject = getSubject(question.subject);
  const difficult = state.difficultQuestionIds.includes(question.id);
  const randomQuestionIds =
    router.query.mode === 'random' && typeof router.query.questions === 'string'
      ? router.query.questions.split(',').filter(Boolean)
      : [];
  const questionById = new Map(questionBank.map((item) => [item.id, item]));
  const randomQuestions = [
    ...new Set(randomQuestionIds),
  ].flatMap((questionId) => {
    const item = questionById.get(questionId);
    return item ? [item] : [];
  });
  const isRandomQuiz =
    randomQuestions.length > 0 &&
    randomQuestions.some((item) => item.id === question.id);
  const paperQuestions = isRandomQuiz
    ? randomQuestions
    : questionBank.filter((item) => item.year === question.year);
  const position = paperQuestions.findIndex((item) => item.id === question.id);
  const randomSearch = isRandomQuiz
    ? `?mode=random&questions=${encodeURIComponent(randomQuestions.map((item) => item.id).join(','))}`
    : '';
  const questionHref = (item: QuizQuestion) => `${item.path}${randomSearch}`;
  const previous = paperQuestions[position - 1];
  const next = paperQuestions[position + 1];
  const answeredCount = paperQuestions.filter(
    (item) =>
      progressByQuestion[item.id]?.selected !== undefined ||
      item.answerKey.kind === 'all-credit',
  ).length;

  useEffect(() => {
    const questionId = question.id;
    const startedAt = new Date().toISOString();
    progressDispatch({ type: 'visit-question', questionId, startedAt });
    if (attempt) return;
    const timer = window.setInterval(() => {
      progressDispatch({ type: 'tick-question', questionId, startedAt });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, question.id]);

  function submitQuiz() {
    if (attempt) return;

    const submittedAt = new Date().toISOString();
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
    const correctCount = paperQuestions.filter((item) =>
      isQuestionCorrect(item, progressByQuestion[item.id]?.selected),
    ).length;
    const unansweredCount = paperQuestions.filter(
      (item) =>
        progressByQuestion[item.id]?.selected === undefined &&
        item.answerKey.kind !== 'all-credit',
    ).length;
    const visitedProgress = paperQuestions.flatMap((item) =>
      progressByQuestion[item.id] ? [progressByQuestion[item.id]!] : [],
    );
    const elapsedSeconds = visitedProgress.reduce(
      (total, item) => total + item.elapsedSeconds,
      0,
    );
    const startedAt = visitedProgress.reduce(
      (earliest, item) =>
        item.startedAt < earliest ? item.startedAt : earliest,
      submittedAt,
    );
    const nextAttempt: QuizAttempt = {
      id: `attempt-${submittedAt}-${question.id}`,
      mode: isRandomQuiz ? 'random' : 'paper',
      subject: question.subject,
      year: paperQuestions.every((item) => item.year === question.year)
        ? question.year
        : null,
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
    const score = calculateScore(attempt.correctCount, paperQuestions.length);

    return (
      <>
        <PageHeader
          eyebrow="RESULT"
          title="本次作答結果"
          description={`總作答時間 ${formatDuration(attempt.elapsedSeconds)}`}
        />
        <section className={styles.resultCard}>
          <div className={styles.scoreRing} aria-label={`本次得分 ${score.toFixed(2)} 分`}>
            <strong>{score.toFixed(2)}</strong>
            <span>/ 60.00 分</span>
          </div>
          <div className={styles.resultSummary}>
            <span>本回作答結果</span>
            <h2>{attempt.correctCount} / {paperQuestions.length} 題答對</h2>
            <p>
              已作答 {paperQuestions.length - attempt.unansweredCount} 題・
              未作答 {attempt.unansweredCount} 題
            </p>
            <div className={styles.resultStats}>
              <div data-tone="success"><strong>{attempt.correctCount}</strong><span>答對</span></div>
              <div data-tone="danger"><strong>{attempt.wrongCount}</strong><span>答錯</span></div>
              <div><strong>{attempt.unansweredCount}</strong><span>未作答</span></div>
              <div><strong>{formatDuration(attempt.elapsedSeconds)}</strong><span>總時間</span></div>
            </div>
          </div>
          <div className={styles.resultActions}>
            <Button render={<Link href="/papers" />}>選擇其他試卷</Button>
            <Button variant="primary" render={<Link href="/history" />}>查看作答紀錄</Button>
          </div>
        </section>
        <section className={styles.reviewSection}>
          <header className={styles.reviewHeader}>
            <div>
              <span>完整對答案</span>
              <h2>逐題作答結果</h2>
            </div>
            <strong>共 {paperQuestions.length} 題</strong>
          </header>
          <div className={styles.reviewList}>
            {paperQuestions.map((item, index) => {
              const selectedAnswer =
                attempt.answers[item.id] === undefined
                  ? '未作答'
                  : String.fromCharCode(65 + attempt.answers[item.id]);
              const itemCorrect = isQuestionCorrect(item, attempt.answers[item.id]);
              const result =
                attempt.answers[item.id] === undefined &&
                item.answerKey.kind !== 'all-credit'
                  ? 'unanswered'
                  : itemCorrect
                    ? 'correct'
                    : 'wrong';
              return (
                <article key={item.id} data-result={result}>
                  <span className={styles.reviewStatus} aria-label={
                    result === 'correct' ? '答對' : result === 'wrong' ? '答錯' : '未作答'
                  }>
                    {result === 'correct' ? (
                      <IconCircleCheck size={19} stroke={2.2} aria-hidden="true" />
                    ) : result === 'wrong' ? (
                      <IconX size={19} stroke={2.2} aria-hidden="true" />
                    ) : (
                      <IconMinus size={19} stroke={2.2} aria-hidden="true" />
                    )}
                  </span>
                  <div className={styles.reviewContent}>
                    <span>
                      {index + 1}. {item.year} 年・第 {item.questionNumber} 題
                    </span>
                    <strong>{item.text || '圖片題目'}</strong>
                    <p>
                      你的答案：{selectedAnswer}
                      <b>標準答案：{formatCorrectAnswer(item)}</b>
                    </p>
                  </div>
                  <Link href={questionHref(item)} onClick={() => setAttempt(null)} aria-label={`查看第 ${item.questionNumber} 題`}>
                    <IconExternalLink size={18} stroke={2} aria-hidden="true" />
                  </Link>
                  <details className={styles.reviewOptions}>
                    <summary>
                      <span>檢視完整選項</span>
                      <IconChevronDown size={17} stroke={2} aria-hidden="true" />
                    </summary>
                    <div className={styles.reviewOptionList}>
                      {item.options.map((option, optionIndex) => {
                        const selected = attempt.answers[item.id] === optionIndex;
                        const accepted =
                          item.answerKey.kind === 'all-credit' ||
                          item.answerKey.options.includes(optionIndex);
                        return (
                          <div
                            key={`${item.id}-${optionIndex}`}
                            data-selected={selected || undefined}
                            data-accepted={accepted || undefined}
                          >
                            <b>{String.fromCharCode(65 + optionIndex)}</b>
                            <span>{option}</span>
                            <small>
                              {selected && accepted
                                ? '你的答案・正確答案'
                                : selected
                                  ? '你的答案'
                                  : accepted
                                    ? '正確答案'
                                    : ''}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                    <footer>
                      <Link href={questionHref(item)} onClick={() => setAttempt(null)}>
                        查看題目
                        <IconExternalLink size={15} stroke={2} aria-hidden="true" />
                      </Link>
                      <Link href={`/community?question=${item.id}`}>
                        詳解與討論
                        <IconMessages size={16} stroke={2} aria-hidden="true" />
                      </Link>
                    </footer>
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={isRandomQuiz ? 'RANDOM QUIZ' : 'PAPER QUIZ'}
        title={isRandomQuiz ? `${subject?.name}・隨機練習` : `${question.year} 年・${subject?.name}`}
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
              <Tag tone="orange">{getQuestionDisplayCategory(question)}</Tag>
              {question.source.kind === 'sample' ? (
                <Tag tone="purple">示範題</Tag>
              ) : null}
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
              onValueChange={(value) =>
                progressDispatch({
                  type: 'select-answer',
                  questionId: question.id,
                  selected: value,
                  startedAt: new Date().toISOString(),
                })
              }
            />
            <Button
              variant="ghost"
              render={<Link href={`/community?question=${question.id}`} />}
            >
              前往詳解與討論 <IconExternalLink size={17} stroke={2} aria-hidden="true" />
            </Button>
          </div>
          <footer className={styles.navigation}>
            {previous ? (
              <Button render={<Link href={questionHref(previous)} />}>
                <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
              </Button>
            ) : (
              <Button disabled>
                <IconArrowLeft size={17} stroke={2} aria-hidden="true" /> 上一題
              </Button>
            )}
            <span>已作答 {answeredCount} / {paperQuestions.length}</span>
            {next ? (
              <Button variant="primary" render={<Link href={questionHref(next)} />}>
                下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
              </Button>
            ) : (
              <Button variant="primary" onClick={submitQuiz}>對答案</Button>
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
            <QuestionNumberGrid>
              {paperQuestions.map((item, index) => (
                <QuestionNumberButton
                  key={item.id}
                  href={questionHref(item)}
                  ariaLabel={`前往第 ${item.questionNumber} 題`}
                  active={index === position}
                  answered={
                    progressByQuestion[item.id]?.selected !== undefined ||
                    item.answerKey.kind === 'all-credit'
                  }
                >
                  {item.questionNumber}
                </QuestionNumberButton>
              ))}
            </QuestionNumberGrid>
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
