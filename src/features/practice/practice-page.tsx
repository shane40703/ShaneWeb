'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { EmptyState, PageHeader, Tag } from '@/components/content/content';
import {
  Button,
  OptionGroup,
  ProgressBar,
  QuantityField,
  SimpleSelect,
  ToggleSwitch,
  useToast,
} from '@/components/ui/ui';
import { getSubject, questions, subjects, years } from '@/data/questions';
import { buildQuiz } from '@/lib/study';
import type { HistoryEntry, PracticeFilters, Question, SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './practice-page.module.css';

const subjectOptions = [
  { value: 'all', label: '全部科目' },
  ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
];

const yearOptions = [...years]
  .reverse()
  .map((year) => ({ value: String(year), label: `民國 ${year} 年` }));

interface SessionAnswer {
  selected: number;
  correct: boolean;
}

function createEntry(question: Question, selected: number): HistoryEntry {
  const correct = selected === question.answer;
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${question.id}`,
    questionId: question.id,
    selected,
    correct,
    answeredAt: new Date().toISOString(),
  };
}

export function PracticePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const directValue = searchParams.get('question');
  const directQuestion = questions.find((question) => question.id === Number(directValue));
  const [directError, setDirectError] = useState(Boolean(directValue && !directQuestion));
  const [filters, setFilters] = useState<PracticeFilters>({
    subject: 'all',
    fromYear: 102,
    toYear: 114,
    count: 5,
    onlyUnanswered: false,
    onlyDifficult: false,
  });
  const [instantOverride, setInstantOverride] = useState<boolean | null>(null);
  const [quiz, setQuiz] = useState<Question[]>(directQuestion ? [directQuestion] : []);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>();
  const [sessionAnswers, setSessionAnswers] = useState<Record<number, SessionAnswer>>({});
  const [completed, setCompleted] = useState(false);
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const instantFeedback = instantOverride ?? state.preferences.instantFeedback;
  const currentQuestion = quiz[questionIndex];
  const currentAnswer = currentQuestion ? sessionAnswers[currentQuestion.id] : undefined;

  function resetSession(nextQuiz: Question[]) {
    setQuiz(nextQuiz);
    setQuestionIndex(0);
    setSelected(undefined);
    setSessionAnswers({});
    setCompleted(false);
    setDirectError(false);
  }

  function startPractice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuiz = buildQuiz(filters, state);
    router.replace('/practice', { scroll: false });
    resetSession(nextQuiz);
    if (!nextQuiz.length) notify('找不到符合條件的題目', '請調整練習範圍後再試一次。');
  }

  function submitAnswer() {
    if (!currentQuestion || selected === undefined) {
      notify('請先選擇答案');
      return;
    }
    if (currentAnswer) return;
    const entry = createEntry(currentQuestion, selected);
    const answer = { selected, correct: entry.correct };
    const nextAnswers = { ...sessionAnswers, [currentQuestion.id]: answer };
    dispatch({ type: 'record-answer', entry });
    setSessionAnswers(nextAnswers);

    if (instantFeedback) {
      notify(entry.correct ? '回答正確' : '答案已記錄', entry.correct ? '做得很好，繼續保持。' : '查看解析後再整理一次觀念。');
      return;
    }

    if (questionIndex === quiz.length - 1) {
      setCompleted(true);
    } else {
      setQuestionIndex((index) => index + 1);
      setSelected(undefined);
    }
  }

  function moveQuestion(direction: -1 | 1) {
    const nextIndex = questionIndex + direction;
    if (nextIndex < 0 || nextIndex >= quiz.length) return;
    setQuestionIndex(nextIndex);
    const nextQuestion = quiz[nextIndex];
    setSelected(sessionAnswers[nextQuestion.id]?.selected);
  }

  function toggleDifficult() {
    if (!currentQuestion) return;
    const active = state.difficultQuestionIds.includes(currentQuestion.id);
    dispatch({ type: 'toggle-difficult', questionId: currentQuestion.id });
    notify(active ? '已取消難題標記' : '已加入難題標記');
  }

  const answeredCount = Object.keys(sessionAnswers).length;
  const score = Object.values(sessionAnswers).filter((answer) => answer.correct).length;

  return (
    <>
      <PageHeader
        eyebrow="CUSTOM PRACTICE"
        title="隨機出題"
        description="設定今天的練習範圍，系統會從示範題庫中組成一份專屬練習。"
      />
      <div className={styles.practiceLayout}>
        <form className={styles.settingsCard} onSubmit={startPractice}>
          <header className={styles.cardHeader}>
            <span className={styles.cardNumber}>01</span>
            <div>
              <strong>練習設定</strong>
              <p>依照目前進度安排題目</p>
            </div>
          </header>
          <SimpleSelect
            label="科目"
            value={filters.subject}
            options={subjectOptions}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                subject: value as SubjectId | 'all',
              }))
            }
          />
          <div className={styles.yearFields}>
            <SimpleSelect
              label="開始年度"
              value={String(filters.fromYear)}
              options={yearOptions}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, fromYear: Number(value) }))
              }
            />
            <span className={styles.yearDivider} aria-hidden="true">
              —
            </span>
            <SimpleSelect
              label="結束年度"
              value={String(filters.toYear)}
              options={yearOptions}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, toYear: Number(value) }))
              }
            />
          </div>
          <QuantityField
            label="題目數量"
            value={filters.count}
            min={1}
            max={20}
            onValueChange={(value) =>
              setFilters((current) => ({ ...current, count: value }))
            }
          />
          <div className={styles.switches}>
            <ToggleSwitch
              label="只出未作答題目"
              checked={filters.onlyUnanswered}
              onCheckedChange={(checked) =>
                setFilters((current) => ({ ...current, onlyUnanswered: checked }))
              }
            />
            <ToggleSwitch
              label="只出難題"
              checked={filters.onlyDifficult}
              onCheckedChange={(checked) =>
                setFilters((current) => ({ ...current, onlyDifficult: checked }))
              }
            />
            <ToggleSwitch
              label="立即顯示解析"
              checked={instantFeedback}
              onCheckedChange={setInstantOverride}
            />
          </div>
          <Button type="submit" variant="primary" fullWidth>
            產生題目 <span aria-hidden="true">→</span>
          </Button>
          <p className={styles.localNote}>練習紀錄只會保留在目前使用的瀏覽器中。</p>
        </form>

        <section className={styles.quizCard} aria-live="polite">
          {directError ? (
            <EmptyState
              symbol="?"
              title="找不到這一道題目"
              description="網址中的題目編號不存在，請回到題庫重新選擇。"
              action={
                <Button variant="primary" render={<Link href="/papers" />}>
                  返回題庫
                </Button>
              }
            />
          ) : completed ? (
            <div className={styles.summary}>
              <span className={styles.summarySymbol}>✓</span>
              <Tag tone="green">PRACTICE COMPLETE</Tag>
              <h2>完成這次練習</h2>
              <p>你答對 {score} 題，共完成 {quiz.length} 題。</p>
              <div className={styles.scoreBar}>
                <strong>{quiz.length ? Math.round((score / quiz.length) * 100) : 0}%</strong>
                <ProgressBar
                  value={quiz.length ? (score / quiz.length) * 100 : 0}
                  label="本次正確率"
                />
              </div>
              {!instantFeedback ? (
                <div className={styles.reviewList}>
                  {quiz.map((question, index) => {
                    const answer = sessionAnswers[question.id];
                    return (
                      <article key={question.id}>
                        <span data-correct={answer?.correct}>第 {index + 1} 題</span>
                        <div>
                          <strong>{answer?.correct ? '回答正確' : '需要再複習'}</strong>
                          <p>{question.explanation}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
              <div className={styles.summaryActions}>
                <Button onClick={() => resetSession([])}>重新設定</Button>
                <Button variant="primary" render={<Link href="/papers" />}>
                  回到題庫
                </Button>
              </div>
            </div>
          ) : currentQuestion ? (
            <div className={styles.questionPanel}>
              <header className={styles.quizHeader}>
                <div>
                  <div className={styles.questionMeta}>
                    <Tag>{getSubject(currentQuestion.subject)?.shortName}</Tag>
                    <Tag tone="purple">{currentQuestion.year} 年</Tag>
                    <Tag tone="orange">{currentQuestion.topic}</Tag>
                  </div>
                  <strong>
                    第 {questionIndex + 1} / {quiz.length} 題
                  </strong>
                </div>
                <Button
                  variant="icon"
                  className={
                    state.difficultQuestionIds.includes(currentQuestion.id)
                      ? styles.starActive
                      : styles.star
                  }
                  onClick={toggleDifficult}
                  aria-label={
                    state.difficultQuestionIds.includes(currentQuestion.id)
                      ? '取消難題標記'
                      : '加入難題標記'
                  }
                >
                  <span aria-hidden="true">★</span>
                </Button>
              </header>
              <ProgressBar
                value={((questionIndex + 1) / quiz.length) * 100}
                label="答題進度"
              />
              <div className={styles.questionBody}>
                <span className={styles.questionIndex}>Q{String(questionIndex + 1).padStart(2, '0')}</span>
                <h2>{currentQuestion.text}</h2>
                <OptionGroup
                  label="請選擇答案"
                  options={currentQuestion.options}
                  value={currentAnswer?.selected ?? selected}
                  disabled={Boolean(currentAnswer)}
                  onValueChange={setSelected}
                />
                {!currentAnswer ? (
                  <Button variant="primary" onClick={submitAnswer}>
                    送出答案
                  </Button>
                ) : instantFeedback ? (
                  <div
                    className={styles.feedback}
                    data-correct={currentAnswer.correct}
                    role="status"
                  >
                    <span>{currentAnswer.correct ? '✓' : '!'}</span>
                    <div>
                      <strong>{currentAnswer.correct ? '回答正確' : '回答錯誤'}</strong>
                      <p>
                        正確答案：{String.fromCharCode(65 + currentQuestion.answer)}.{' '}
                        {currentQuestion.options[currentQuestion.answer]}
                      </p>
                      <p>{currentQuestion.explanation}</p>
                    </div>
                  </div>
                ) : null}
              </div>
              <footer className={styles.quizNavigation}>
                <Button
                  onClick={() => moveQuestion(-1)}
                  disabled={questionIndex === 0}
                >
                  ← 上一題
                </Button>
                <span>
                  已完成 {answeredCount} / {quiz.length}
                </span>
                {questionIndex === quiz.length - 1 ? (
                  <Button
                    variant="primary"
                    disabled={!currentAnswer}
                    onClick={() => setCompleted(true)}
                  >
                    完成練習
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={!currentAnswer}
                    onClick={() => moveQuestion(1)}
                  >
                    下一題 →
                  </Button>
                )}
              </footer>
            </div>
          ) : (
            <EmptyState
              symbol="⤨"
              title="設定你的第一份練習"
              description="從左側選擇科目、年度與題目數量，按下「產生題目」即可開始。"
            />
          )}
        </section>
      </div>
    </>
  );
}
