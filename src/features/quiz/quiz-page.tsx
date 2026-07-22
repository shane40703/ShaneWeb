import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  DifficultButton,
  EmptyState,
  PageHeader,
  QuestionCard,
  Tag,
} from '@/components/content/content';
import { Button, OptionGroup, ProgressBar } from '@/components/ui/ui';
import { getQuestion, getSubject } from '@/data/questions';
import {
  createAttempt,
  formatDuration,
  getPaperQuestions,
  isSubjectId,
  parseYear,
} from '@/lib/study';
import type { Question, QuizAttempt } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './quiz-page.module.css';

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function QuizPage() {
  const router = useRouter();
  const source = useMemo(() => {
    if (!router.isReady) return null;
    if (queryValue(router.query.mode) === 'random') {
      const ids = (queryValue(router.query.questions) ?? '').split(',').filter(Boolean);
      return ids.map((id) => getQuestion(id)).filter((question): question is Question => Boolean(question));
    }
    const subject = queryValue(router.query.subject);
    const year = parseYear(router.query.year);
    return isSubjectId(subject) && year ? getPaperQuestions(subject, year) : [];
  }, [router.isReady, router.query.mode, router.query.questions, router.query.subject, router.query.year]);

  if (!router.isReady || source === null) {
    return <EmptyState symbol="…" title="正在載入試卷" description="請稍候。" />;
  }

  if (!source.length) {
    const hasPaperQuery = isSubjectId(queryValue(router.query.subject)) && parseYear(router.query.year);
    return (
      <>
        <PageHeader eyebrow="QUIZ" title="作答頁" />
        <section className={styles.card}>
          <EmptyState
            symbol="□"
            title={hasPaperQuery ? '這份試卷尚無題目資料' : '尚未選擇試卷'}
            description={
              hasPaperQuery
                ? '目前題庫資料尚未涵蓋這個科目與年度，請改選已收錄的試卷。'
                : '請先到歷屆試題選擇科目與年度，或使用隨機出題。'
            }
            action={
              <Button variant="primary" render={<Link href="/papers" />}>
                返回歷屆試題
              </Button>
            }
          />
        </section>
      </>
    );
  }

  const mode = queryValue(router.query.mode) === 'random' ? 'random' : 'paper';
  const sessionKey = `${mode}:${source.map((question) => question.id).join(',')}`;
  return <QuizSession key={sessionKey} source={source} mode={mode} />;
}

function QuizSession({ source, mode }: { source: readonly Question[]; mode: QuizAttempt['mode'] }) {
  const { state, dispatch } = useAppState();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt] = useState(() => new Date().toISOString());
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const currentQuestion = source[questionIndex];

  useEffect(() => {
    if (attempt) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  function submitQuiz() {
    if (attempt) return;
    const nextAttempt = createAttempt({ mode, source, answers, startedAt, elapsedSeconds });
    dispatch({ type: 'save-attempt', attempt: nextAttempt });
    setAttempt(nextAttempt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (attempt) {
    const wrongQuestions = source.filter(
      (question) => answers[question.id] !== undefined && answers[question.id] !== question.answer,
    );
    const score = source.length ? Math.round((attempt.correctCount / source.length) * 100) : 0;
    return (
      <>
        <PageHeader eyebrow="RESULT" title="本次作答結果" description={`總作答時間 ${formatDuration(attempt.elapsedSeconds)}`} />
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
              {wrongQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  difficult={state.difficultQuestionIds.includes(question.id)}
                  onToggleDifficult={() => dispatch({ type: 'toggle-difficult', questionId: question.id })}
                />
              ))}
            </div>
          ) : (
            <EmptyState symbol="✓" title="沒有答錯題目" description="這次作答沒有已作答但答錯的題目。" />
          )}
        </section>
      </>
    );
  }

  const subject = getSubject(currentQuestion.subject);
  const selected = answers[currentQuestion.id];
  const answeredCount = Object.keys(answers).length;
  const difficult = state.difficultQuestionIds.includes(currentQuestion.id);

  return (
    <>
      <PageHeader
        eyebrow={mode === 'random' ? 'RANDOM QUIZ' : 'PAPER QUIZ'}
        title={mode === 'random' ? '隨機題組' : `${currentQuestion.year} 年・${subject?.name}`}
        action={<div className={styles.timer}><span>作答時間</span><strong>{formatDuration(elapsedSeconds)}</strong></div>}
      />
      <section className={styles.card}>
        <header className={styles.quizHeader}>
          <div className={styles.meta}>
            <Tag tone="green">{subject?.shortName}</Tag>
            <Tag>{currentQuestion.year} 年</Tag>
            <Tag tone="orange">{currentQuestion.primaryCategory}</Tag>
          </div>
          <DifficultButton
            active={difficult}
            onClick={() => dispatch({ type: 'toggle-difficult', questionId: currentQuestion.id })}
          />
        </header>
        <ProgressBar value={((questionIndex + 1) / source.length) * 100} label="答題進度" />
        <div className={styles.questionBody}>
          <span className={styles.questionNumber}>第 {currentQuestion.questionNumber} 題・題組 {questionIndex + 1}/{source.length}</span>
          <h2>{currentQuestion.text}</h2>
          <OptionGroup
            label="請選擇答案"
            options={currentQuestion.options}
            value={selected}
            onValueChange={(value) => setAnswers((current) => ({ ...current, [currentQuestion.id]: value }))}
          />
          <Button
            variant="ghost"
            render={<Link href={`/community?question=${currentQuestion.id}`} />}
          >
            前往詳解與討論 <span aria-hidden="true">↗</span>
          </Button>
        </div>
        <footer className={styles.navigation}>
          <Button onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))} disabled={questionIndex === 0}>
            ← 上一題
          </Button>
          <span>已作答 {answeredCount} / {source.length}</span>
          {questionIndex < source.length - 1 ? (
            <Button variant="primary" onClick={() => setQuestionIndex((current) => Math.min(source.length - 1, current + 1))}>
              下一題 →
            </Button>
          ) : (
            <Button variant="primary" onClick={submitQuiz}>交卷</Button>
          )}
        </footer>
      </section>
    </>
  );
}
