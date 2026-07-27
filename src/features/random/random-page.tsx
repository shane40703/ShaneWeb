import { useRouter } from 'next/router';
import { useState } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { subjects, years } from '@/question-bank/catalog';
import { analysisCategoryCatalog } from '@/question-bank/schema';
import {
  getAnalysisCategory,
  isSubjectId,
  pickRandomItems,
} from '@/lib/study';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import styles from './random-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function RandomPage({ questions }: { questions: QuestionSummary[] }) {
  const router = useRouter();
  const querySubject = valueOf(router.query.subject);
  const initialSubject: SubjectId = isSubjectId(querySubject) ? querySubject : 'law';
  const [subjectId, setSubjectId] = useState<SubjectId>(initialSubject);
  const [fromYearValue, setFromYearValue] = useState<number>();
  const [toYearValue, setToYearValue] = useState<number>();
  const [categoryValue, setCategoryValue] = useState('all');
  const [countValue, setCountValue] = useState(10);
  const subject = subjects.find((item) => item.id === subjectId) ?? subjects[0];
  const availableYears = years.filter((year) =>
    questions.some(
      (question) => question.subject === subjectId && question.year === year,
    ),
  );
  const fromYear = availableYears.includes(fromYearValue ?? 0)
    ? fromYearValue!
    : (availableYears.at(-1) ?? years.at(-1)!);
  const toYear = availableYears.includes(toYearValue ?? 0)
    ? toYearValue!
    : (availableYears[0] ?? years[0]);
  const rangeStart = Math.min(fromYear, toYear);
  const rangeEnd = Math.max(fromYear, toYear);
  const rangeCandidates = questions.filter(
    (question) =>
      question.subject === subjectId &&
      question.year >= rangeStart &&
      question.year <= rangeEnd,
  );
  const categoryCounts = new Map<string, number>();
  rangeCandidates.forEach((question) => {
    const category = getAnalysisCategory(
      question.subject,
      question.topic,
      question.primaryCategory,
    );
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  });
  const availableCategories = [
    ...Object.keys(analysisCategoryCatalog[subjectId]).filter((category) =>
      categoryCounts.has(category),
    ),
    ...[...categoryCounts.keys()]
      .filter((category) => !(category in analysisCategoryCatalog[subjectId]))
      .sort((left, right) => left.localeCompare(right, 'zh-Hant')),
  ];
  const category = availableCategories.includes(categoryValue)
    ? categoryValue
    : 'all';
  const candidates =
    category === 'all'
      ? rangeCandidates
      : rangeCandidates.filter(
          (question) =>
            getAnalysisCategory(
              question.subject,
              question.topic,
              question.primaryCategory,
            ) === category,
        );
  const countOptions = [5, 10, 15, 20, 30].filter((count) => count <= candidates.length);
  if (candidates.length && !countOptions.length) {
    countOptions.push(candidates.length);
  }
  const count = countOptions.includes(countValue)
    ? countValue
    : (countOptions.at(-1) ?? 0);

  function changeSubject(nextSubject: SubjectId) {
    setSubjectId(nextSubject);
    setFromYearValue(undefined);
    setToYearValue(undefined);
    setCategoryValue('all');
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
                  onChange={(event) => {
                    setFromYearValue(Number(event.target.value));
                    setCategoryValue('all');
                  }}
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
                  onChange={(event) => {
                    setToYearValue(Number(event.target.value));
                    setCategoryValue('all');
                  }}
                >
                  {availableYears.map((candidateYear) => (
                    <option key={candidateYear} value={candidateYear}>
                      {candidateYear} 年
                    </option>
                  ))}
                </select>
              </label>
              <strong>
                <b>{rangeCandidates.length}</b> 題符合年度
              </strong>
            </div>
          </div>
        </section>

        <section>
          <span className={styles.stepNumber}>3</span>
          <div>
            <h3>選擇題目類別</h3>
            <p>可從跨年度的相同類別集中抽題。</p>
            <div className={styles.categoryChoices}>
              <button
                type="button"
                aria-label={`全部類別 ${rangeCandidates.length} 題`}
                aria-pressed={category === 'all'}
                onClick={() => setCategoryValue('all')}
              >
                <strong>全部類別</strong>
                <small>{rangeCandidates.length} 題</small>
              </button>
              {availableCategories.map((candidateCategory) => (
                <button
                  type="button"
                  key={candidateCategory}
                  aria-label={`${candidateCategory} ${categoryCounts.get(candidateCategory)} 題`}
                  aria-pressed={candidateCategory === category}
                  onClick={() => setCategoryValue(candidateCategory)}
                >
                  <strong>{candidateCategory}</strong>
                  <small>{categoryCounts.get(candidateCategory)} 題</small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <span className={styles.stepNumber}>4</span>
          <div>
            <h3>選擇題數</h3>
            <p>從符合科目、年度與類別的考古題中隨機抽取。</p>
            <div className={styles.countChoices}>
              {countOptions.map((candidateCount) => (
                <button
                  type="button"
                  key={candidateCount}
                  aria-pressed={candidateCount === count}
                  onClick={() => setCountValue(candidateCount)}
                >
                  <strong>{candidateCount}</strong> 題
                  <small>約 {Math.max(1, Math.round(candidateCount * 1.4))} 分鐘</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer>
        <span>
          <strong>
            {subject.name}・{rangeStart}–{rangeEnd} 年
            {category === 'all' ? '' : `・${category}`}
          </strong>
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
