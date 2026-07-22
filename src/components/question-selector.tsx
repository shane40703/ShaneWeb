import { type ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import { SubjectIconBadge } from '@/components/subject-icon';
import { subjects } from '@/question-bank/catalog';
import type { SubjectId } from '@/lib/types';
import styles from './question-selector.module.css';

export type SelectorYear = number | 'all';

export interface SelectorYearOption {
  value: SelectorYear;
  label?: string;
  disabled?: boolean;
}

export function QuestionSelector({
  heading,
  description,
  subjectId,
  year,
  yearOptions,
  onSubjectChange,
  onYearChange,
  questionPicker,
  summary,
  action,
  ariaLabel,
}: {
  heading: string;
  description: string;
  subjectId: SubjectId;
  year: SelectorYear;
  yearOptions: readonly SelectorYearOption[];
  onSubjectChange: (subjectId: SubjectId) => void;
  onYearChange: (year: SelectorYear) => void;
  questionPicker?: ReactNode;
  summary?: ReactNode;
  action?: ReactNode;
  ariaLabel: string;
}) {
  return (
    <section className={styles.panel} aria-label={ariaLabel}>
      <div className={styles.body}>
        <header className={styles.heading}>
          <h1>{heading}</h1>
          <p>{description}</p>
        </header>

        <fieldset className={styles.fieldset}>
          <legend className={styles.visuallyHidden}>科目</legend>
          <div className={styles.subjectGrid}>
            {subjects.map((subject) => {
              const selected = subject.id === subjectId;
              return (
                <button
                  key={subject.id}
                  type="button"
                  className={styles.subjectButton}
                  data-subject={subject.id}
                  aria-pressed={selected}
                  onClick={() => onSubjectChange(subject.id)}
                >
                  {selected ? (
                    <span className={styles.check} aria-hidden="true">
                      <IconCheck size={11} stroke={3} />
                    </span>
                  ) : null}
                  <SubjectIconBadge subject={subject.id} />
                  <span className={styles.subjectCopy}>
                    <strong>{subject.name}</strong>
                    <small>{subject.shortName}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset
          className={`${styles.fieldset} ${styles.yearFieldset} ${questionPicker ? styles.yearFieldsetWithQuestions : ''}`}
        >
          <legend className={styles.visuallyHidden}>年度</legend>
          <div className={styles.yearList}>
            {yearOptions.map((option) => {
              const selected = option.value === year;
              const label =
                typeof option.value === 'number'
                  ? `${option.value} 年`
                  : option.label ?? '跨年度';
              return (
                <button
                  key={option.value}
                  type="button"
                  className={styles.yearButton}
                  aria-pressed={selected}
                  disabled={option.disabled}
                  onClick={() => onYearChange(option.value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {questionPicker ? <div className={styles.questionPicker}>{questionPicker}</div> : null}
      </div>

      {summary || action ? (
        <footer className={styles.footer}>
          <div className={styles.summary}>{summary}</div>
          {action ? <div className={styles.action}>{action}</div> : null}
        </footer>
      ) : null}
    </section>
  );
}

export function QuestionNumberPicker({
  questions,
  value,
  onValueChange,
}: {
  questions: readonly { id: string; questionNumber: number }[];
  value: string;
  onValueChange: (questionId: string) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.visuallyHidden}>題號</legend>
      <QuestionNumberGrid>
        {questions.map((question) => (
          <QuestionNumberButton
            key={question.id}
            ariaLabel={`第 ${question.questionNumber} 題`}
            active={question.id === value}
            onClick={() => onValueChange(question.id)}
          >
            {question.questionNumber}
          </QuestionNumberButton>
        ))}
      </QuestionNumberGrid>
    </fieldset>
  );
}
