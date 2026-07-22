import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconExternalLink,
  IconX,
} from '@tabler/icons-react';
import {
  DifficultButton,
  PageHeader,
  QuestionPrompt,
  QuestionSourceLine,
  Tag,
} from '@/components/content/content';
import { Button, OptionGroup, ProgressBar } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import {
  createAttempt,
  formatDuration,
  getAcceptedAnswerIndexes,
  isQuestionCorrect,
} from '@/lib/study';
import type { Question } from '@/lib/types';
import { useAppState } from '@/state/app-state';
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
  const [selected, setSelected] = useState<number>();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt] = useState(() => new Date().toISOString());
  const [submitted, setSubmitted] = useState(false);
  const subject = getSubject(question.subject);
  const difficult = state.difficultQuestionIds.includes(question.id);
  const correct = submitted && isQuestionCorrect(question, selected);
  const acceptedAnswers = getAcceptedAnswerIndexes(question);
  const previous = paperQuestions[position - 1];
  const next = paperQuestions[position + 1];

  useEffect(() => {
    if (submitted) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [submitted]);

  function submitAnswer() {
    if (submitted || (selected === undefined && question.answerKey.kind !== 'all-credit')) {
      return;
    }
    const answers = selected === undefined ? {} : { [question.id]: selected };
    const attempt = createAttempt({
      mode: 'paper',
      source: [question],
      answers,
      startedAt,
      elapsedSeconds,
    });
    dispatch({
      type: 'save-attempt',
      attempt,
      results: selected === undefined ? {} : { [question.id]: isQuestionCorrect(question, selected) },
    });
    setSubmitted(true);
  }

  return (
    <>
      <PageHeader
        eyebrow="STATIC QUESTION"
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
              onValueChange={setSelected}
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
            <span>靜態題目頁 {position + 1} / {paperQuestions.length}</span>
            {next ? (
              <Button variant="primary" render={<Link href={next.path} />}>
                下一題 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
              </Button>
            ) : (
              <Button variant="primary" render={<Link href="/papers" />}>
                返回歷屆試題
              </Button>
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
                data-answered={Boolean(state.answers[item.id])}
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
