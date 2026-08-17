import Link from 'next/link';
import { useRouter } from 'next/router';
import { IconArrowRight } from '@tabler/icons-react';
import {
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import { subjects, years } from '@/question-bank/catalog';
import { isSubjectId, parseYear } from '@/lib/study';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import { useClientReady } from '@/lib/use-client-ready';
import {
  createQuizProgressScope,
  getPaperResumeQuestionId,
  readQuizProgress,
} from '@/features/quiz/quiz-state';
import styles from './papers-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function PapersPage({ questions }: { questions: QuestionSummary[] }) {
  const router = useRouter();
  const clientReady = useClientReady();
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
    .filter(
      (question) =>
        question.subject === subjectId &&
        question.year === year,
    )
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const progressScope = createQuizProgressScope({
    mode: 'paper',
    subject: subjectId,
    year,
  });
  const resumeQuestionId =
    clientReady && progressScope
      ? getPaperResumeQuestionId(
          readQuizProgress(progressScope),
          paperQuestions.map((item) => item.id),
        )
      : null;
  const resumeQuestion = paperQuestions.find(
    (item) => item.id === resumeQuestionId,
  );

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

  return (
    <QuestionSelector
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
          <Link
            className={styles.startButton}
            href={(resumeQuestion ?? paperQuestions[0]).path}
          >
            {resumeQuestion ? '繼續作答' : '開始作答'}
            <IconArrowRight size={16} stroke={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className={styles.disabledAction} aria-disabled="true">
            尚未收錄
          </span>
        )
      }
    />
  );
}
