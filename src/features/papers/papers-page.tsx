import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { IconArrowRight, IconSparkles } from '@tabler/icons-react';
import {
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import { subjects, years } from '@/question-bank/catalog';
import { isSubjectId, parseYear, pickRandomItems } from '@/lib/study';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import styles from './papers-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function PapersPage({ questions }: { questions: QuestionSummary[] }) {
  const router = useRouter();
  const [randomFromYearValue, setRandomFromYearValue] = useState<number>();
  const [randomToYearValue, setRandomToYearValue] = useState<number>();
  const [randomCountValue, setRandomCountValue] = useState(10);
  const querySubject = valueOf(router.query.subject);
  const subjectId: SubjectId = isSubjectId(querySubject) ? querySubject : 'law';
  const availableYears = years.filter((year) =>
    questions.some((question) => question.subject === subjectId && question.year === year),
  );
  const queryYear = parseYear(router.query.year);
  const year = queryYear && availableYears.includes(queryYear)
    ? queryYear
    : availableYears[0] ?? years[0];
  const subject = subjects.find((item) => item.id === subjectId) ?? subjects[0];
  const paperQuestions = questions
    .filter((question) => question.subject === subjectId && question.year === year)
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const randomFromYear = availableYears.includes(randomFromYearValue ?? 0)
    ? randomFromYearValue!
    : availableYears.at(-1) ?? year;
  const randomToYear = availableYears.includes(randomToYearValue ?? 0)
    ? randomToYearValue!
    : availableYears[0] ?? year;
  const rangeStart = Math.min(randomFromYear, randomToYear);
  const rangeEnd = Math.max(randomFromYear, randomToYear);
  const randomCandidates = questions.filter(
    (question) =>
      question.subject === subjectId &&
      question.year >= rangeStart &&
      question.year <= rangeEnd,
  );
  const standardCounts = [5, 10, 15, 20, 30];
  const randomCountOptions = standardCounts.filter(
    (count) => count <= randomCandidates.length,
  );
  if (randomCandidates.length && !randomCountOptions.length) {
    randomCountOptions.push(randomCandidates.length);
  }
  const randomCount = randomCountOptions.includes(randomCountValue)
    ? randomCountValue
    : randomCountOptions.at(-1) ?? 0;

  function updateSelection(nextSubject: SubjectId, nextYear: number) {
    void router.replace(
      { pathname: '/papers', query: { subject: nextSubject, year: nextYear } },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function changeSubject(nextSubject: SubjectId) {
    const nextAvailableYears = years.filter((candidateYear) =>
      questions.some(
        (question) =>
          question.subject === nextSubject && question.year === candidateYear,
      ),
    );
    const nextYear = nextAvailableYears.includes(year)
      ? year
      : nextAvailableYears[0] ?? years[0];
    updateSelection(nextSubject, nextYear);
  }

  function changeYear(nextYear: SelectorYear) {
    if (typeof nextYear === 'number') updateSelection(subjectId, nextYear);
  }

  function startRandomQuiz() {
    const picked = pickRandomItems(randomCandidates, randomCount);
    if (!picked.length) return;
    void router.push({
      pathname: picked[0].path,
      query: {
        mode: 'random',
        questions: picked.map((question) => question.id).join(','),
      },
    });
  }

  return (
    <>
      <QuestionSelector
        heading="選擇科目與年度"
        description="選好後即可開始作答。"
        subjectId={subjectId}
        year={year}
        yearOptions={years.map((candidateYear) => ({
          value: candidateYear,
          disabled: !availableYears.includes(candidateYear),
        }))}
        onSubjectChange={changeSubject}
        onYearChange={changeYear}
        ariaLabel="試卷選擇"
        summary={
          <>
            已選 <strong>{subject.name} · {year} 年</strong>
          </>
        }
        action={
          paperQuestions[0] ? (
            <Link className={styles.startButton} href={paperQuestions[0].path}>
              開始作答
              <IconArrowRight size={16} stroke={2} aria-hidden="true" />
            </Link>
          ) : (
            <span className={styles.disabledAction} aria-disabled="true">
              尚未收錄
            </span>
          )
        }
      />

      <section className={styles.randomPanel} aria-labelledby="random-quiz-title">
        <header>
          <span className={styles.randomIcon}>
            <IconSparkles size={22} stroke={2} aria-hidden="true" />
          </span>
          <div>
            <span>RANDOM QUIZ</span>
            <h2 id="random-quiz-title">隨機出題</h2>
            <p>依考古題年度範圍隨機抽題，每一題不重複。</p>
          </div>
        </header>

        <div className={styles.randomSteps}>
          <section>
            <span className={styles.stepNumber}>1</span>
            <div>
              <h3>選擇科目</h3>
              <p>每次練習只選一科。</p>
              <div className={styles.randomSubjects}>
                {subjects.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={item.id === subjectId}
                    onClick={() => changeSubject(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <span className={styles.stepNumber}>2</span>
            <div>
              <h3>選擇年度範圍</h3>
              <p>起訖年度包含在抽題範圍內。</p>
              <div className={styles.yearRange}>
                <label>
                  從
                  <select
                    aria-label="隨機出題起始年度"
                    value={randomFromYear}
                    onChange={(event) => setRandomFromYearValue(Number(event.target.value))}
                  >
                    {[...availableYears].reverse().map((candidateYear) => (
                      <option key={candidateYear} value={candidateYear}>{candidateYear} 年</option>
                    ))}
                  </select>
                </label>
                <span>至</span>
                <label>
                  到
                  <select
                    aria-label="隨機出題結束年度"
                    value={randomToYear}
                    onChange={(event) => setRandomToYearValue(Number(event.target.value))}
                  >
                    {availableYears.map((candidateYear) => (
                      <option key={candidateYear} value={candidateYear}>{candidateYear} 年</option>
                    ))}
                  </select>
                </label>
                <strong><b>{randomCandidates.length}</b> 題符合條件</strong>
              </div>
            </div>
          </section>

          <section>
            <span className={styles.stepNumber}>3</span>
            <div>
              <h3>選擇題數</h3>
              <p>從符合條件的考古題中隨機抽取。</p>
              <div className={styles.countChoices}>
                {randomCountOptions.map((count) => (
                  <button
                    type="button"
                    key={count}
                    aria-pressed={count === randomCount}
                    onClick={() => setRandomCountValue(count)}
                  >
                    <strong>{count}</strong> 題
                    <small>約 {Math.max(1, Math.round(count * 1.4))} 分鐘</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <footer>
          <span>
            <strong>{subject.name}・{rangeStart}–{rangeEnd} 年</strong>
            從 {randomCandidates.length} 題中抽出 {randomCount} 題
          </span>
          <button
            type="button"
            className={styles.randomStart}
            disabled={!randomCount}
            onClick={startRandomQuiz}
          >
            抽出題組
            <IconSparkles size={17} stroke={2} aria-hidden="true" />
          </button>
        </footer>
      </section>
    </>
  );
}
