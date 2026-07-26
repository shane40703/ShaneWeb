import { useRouter } from 'next/router';
import { useState } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { subjects, years } from '@/question-bank/catalog';
import { isSubjectId, pickRandomItems } from '@/lib/study';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import styles from '../papers/papers-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function RandomPage({ questions }: { questions: QuestionSummary[] }) {
  const router = useRouter();
  const querySubject = valueOf(router.query.subject);
  const initialSubject: SubjectId = isSubjectId(querySubject)
    ? querySubject
    : 'law';
  const [subjectId, setSubjectId] = useState<SubjectId>(initialSubject);
  const [fromYearValue, setFromYearValue] = useState<number>();
  const [toYearValue, setToYearValue] = useState<number>();
  const [countValue, setCountValue] = useState(10);
  const subject = subjects.find((item) => item.id === subjectId) ?? subjects[0];
  const availableYears = years.filter((year) =>
    questions.some(
      (question) => question.subject === subjectId && question.year === year,
    ),
  );
  const fromYear = availableYears.includes(fromYearValue ?? 0)
    ? fromYearValue!
    : availableYears.at(-1) ?? years.at(-1)!;
  const toYear = availableYears.includes(toYearValue ?? 0)
    ? toYearValue!
    : availableYears[0] ?? years[0];
  const rangeStart = Math.min(fromYear, toYear);
  const rangeEnd = Math.max(fromYear, toYear);
  const candidates = questions.filter(
    (question) =>
      question.subject === subjectId &&
      question.year >= rangeStart &&
      question.year <= rangeEnd,
  );
  const countOptions = [5, 10, 15, 20, 30].filter(
    (count) => count <= candidates.length,
  );
  if (candidates.length && !countOptions.length) {
    countOptions.push(candidates.length);
  }
  const count = countOptions.includes(countValue)
    ? countValue
    : countOptions.at(-1) ?? 0;

  function changeSubject(nextSubject: SubjectId) {
    setSubjectId(nextSubject);
    setFromYearValue(undefined);
    setToYearValue(undefined);
    void router.replace(
      { pathname: '/random', query: { subject: nextSubject } },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function startRandomQuiz() {
    const picked = pickRandomItems(candidates, count);
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
    <section className={styles.randomPanel} aria-label="建立隨機題組">
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
                    value={fromYear}
                    onChange={(event) =>
                      setFromYearValue(Number(event.target.value))
                    }
                  >
                    {[...availableYears].reverse().map((candidateYear) => (
                      <option key={candidateYear} value={candidateYear}>
                        {candidateYear} 年
                      </option>
                    ))}
                  </select>
                </label>
                <span>至</span>
                <label>
                  到
                  <select
                    aria-label="隨機出題結束年度"
                    value={toYear}
                    onChange={(event) =>
                      setToYearValue(Number(event.target.value))
                    }
                  >
                    {availableYears.map((candidateYear) => (
                      <option key={candidateYear} value={candidateYear}>
                        {candidateYear} 年
                      </option>
                    ))}
                  </select>
                </label>
                <strong><b>{candidates.length}</b> 題符合條件</strong>
              </div>
            </div>
        </section>

        <section>
            <span className={styles.stepNumber}>3</span>
            <div>
              <h3>選擇題數</h3>
              <p>從符合條件的考古題中隨機抽取。</p>
              <div className={styles.countChoices}>
                {countOptions.map((candidateCount) => (
                  <button
                    type="button"
                    key={candidateCount}
                    aria-pressed={candidateCount === count}
                    onClick={() => setCountValue(candidateCount)}
                  >
                    <strong>{candidateCount}</strong> 題
                    <small>
                      約 {Math.max(1, Math.round(candidateCount * 1.4))} 分鐘
                    </small>
                  </button>
                ))}
              </div>
            </div>
        </section>
      </div>

      <footer>
          <span>
            <strong>{subject.name}・{rangeStart}–{rangeEnd} 年</strong>
            從 {candidates.length} 題中抽出 {count} 題
          </span>
          <button
            type="button"
            className={styles.randomStart}
            disabled={!count}
            onClick={startRandomQuiz}
          >
            抽出題組
            <IconSparkles size={17} stroke={2} aria-hidden="true" />
          </button>
      </footer>
    </section>
  );
}
