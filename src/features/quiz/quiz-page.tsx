import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useReducer, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconExternalLink,
} from '@tabler/icons-react';
import { AttemptReview } from '@/components/attempt-review';
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
  const questionHasImage = question.content.some(
    (block) => block.kind === 'image',
  );
  const difficult = state.difficultQuestionIds.includes(question.id);
  const randomQuestionIds =
    router.query.mode === 'random' && typeof router.query.questions === 'string'
      ? router.query.questions.split(',').filter(Boolean)
      : [];
  const eligibleQuestionBank = questionBank.filter(
    (item) => item.answerKey.kind !== 'all-credit',
  );
  const questionById = new Map(
    eligibleQuestionBank.map((item) => [item.id, item]),
  );
  const currentQuizQuestion = questionById.get(question.id);
  const isSingleQuestion = router.query.mode === 'single';
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
    : isSingleQuestion
      ? currentQuizQuestion
        ? [currentQuizQuestion]
        : []
      : eligibleQuestionBank.filter((item) => item.year === question.year);
  const position = paperQuestions.findIndex((item) => item.id === question.id);
  const questionSearch = isRandomQuiz
    ? `?mode=random&questions=${encodeURIComponent(randomQuestions.map((item) => item.id).join(','))}`
    : isSingleQuestion
      ? '?mode=single'
      : '';
  const questionHref = (item: QuizQuestion) => `${item.path}${questionSearch}`;
  const previous = paperQuestions[position - 1];
  const next = paperQuestions[position + 1];
  const answeredCount = paperQuestions.filter(
    (item) => progressByQuestion[item.id]?.selected !== undefined,
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
      (item) => progressByQuestion[item.id]?.selected === undefined,
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
        <section className={styles.resultCard}>
          <header className={styles.resultHeading}>
            <span>RESULT</span>
            <h1>本回作答結果</h1>
            <p>總作答時間 {formatDuration(attempt.elapsedSeconds)}</p>
          </header>
          <div className={styles.scoreRing} aria-label={`本次得分 ${score.toFixed(2)} 分`}>
            <strong>{score.toFixed(2)}</strong>
            <span>/ 60.00 分</span>
          </div>
          <div className={styles.resultSummary}>
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
        </section>
        <div className={styles.resultReviewLayout}>
          <AttemptReview
            attempt={attempt}
            questions={paperQuestions}
            anchorPrefix="result-question"
          />
          <aside
            className={styles.questionNavigator}
            aria-label="作答結果題號導覽"
          >
            <header>
              <div>
                <span>RESULT MAP</span>
                <h2>題號導覽</h2>
              </div>
              <strong>{attempt.correctCount}/{paperQuestions.length}</strong>
            </header>
            <div className={styles.questionNumbers}>
              <QuestionNumberGrid>
                {paperQuestions.map((item) => {
                  const itemDifficult =
                    state.difficultQuestionIds.includes(item.id);
                  const itemSelected = attempt.answers[item.id];
                  const itemWrong =
                    itemSelected !== undefined &&
                    !isQuestionCorrect(item, itemSelected);

                  return (
                    <QuestionNumberButton
                      key={item.id}
                      href={`#result-question-${item.id}`}
                      ariaLabel={`查看第 ${item.questionNumber} 題結果`}
                      active={false}
                      answered={itemSelected !== undefined}
                      difficult={itemDifficult}
                      wrong={itemWrong}
                    >
                      {item.questionNumber}
                    </QuestionNumberButton>
                  );
                })}
              </QuestionNumberGrid>
            </div>
            <footer className={styles.navigatorLegend}>
              <span><i data-tone="wrong" />答錯</span>
              <span><i data-tone="difficult" />難題</span>
              <span><i data-tone="combined" />答錯＋難題</span>
            </footer>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          isRandomQuiz
            ? 'RANDOM QUIZ'
            : isSingleQuestion
              ? 'SINGLE QUESTION'
              : 'PAPER QUIZ'
        }
        title={
          isRandomQuiz
            ? `${subject?.name}・隨機練習`
            : isSingleQuestion
              ? `${question.year} 年・${subject?.name}・第 ${question.questionNumber} 題`
              : `${question.year} 年・${subject?.name}`
        }
        compact
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
          <div
            className={styles.questionBody}
            data-has-image={questionHasImage || undefined}
          >
            <div className={styles.questionContentColumn}>
              <span className={styles.questionNumber}>
                第 {question.questionNumber} 題・收錄題目 {position + 1}/{paperQuestions.length}
              </span>
              <QuestionPrompt question={question} />
              <QuestionSourceLine question={question} />
            </div>
            <div className={styles.answerColumn}>
              <span className={styles.answerHeading}>選擇答案</span>
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
              {isRandomQuiz || isSingleQuestion ? (
                <Button
                  variant="ghost"
                  render={<Link href={`/community?question=${question.id}`} />}
                >
                  前往詳解與討論 <IconExternalLink size={17} stroke={2} aria-hidden="true" />
                </Button>
              ) : null}
            </div>
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
              {paperQuestions.map((item, index) => {
                const itemDifficult =
                  state.difficultQuestionIds.includes(item.id);

                return (
                  <QuestionNumberButton
                    key={item.id}
                    href={questionHref(item)}
                    ariaLabel={`前往第 ${item.questionNumber} 題`}
                    active={index === position}
                    answered={
                      progressByQuestion[item.id]?.selected !== undefined
                    }
                    difficult={itemDifficult}
                  >
                    {item.questionNumber}
                  </QuestionNumberButton>
                );
              })}
            </QuestionNumberGrid>
          </div>
          <footer className={styles.navigatorLegend}>
            <span><i data-tone="current" />目前題目</span>
            <span><i data-tone="answered" />已作答</span>
            <span><i data-tone="difficult" />難題</span>
          </footer>
        </aside>
      </div>
    </>
  );
}
