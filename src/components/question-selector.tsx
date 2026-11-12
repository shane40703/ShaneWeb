import { type ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { InPageLink } from '@/components/in-page-link';
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
  subjectId,
  year,
  yearOptions,
  onSubjectChange,
  onYearChange,
  subjectHref,
  yearHref,
  disabledSubjectIds = [],
  questionPicker,
  summary,
  action,
  ariaLabel,
}: {
  /** Unset where no subject is chosen yet, such as 歷屆試題討論版 itself. */
  subjectId?: SubjectId;
  /** Unset where no year is chosen yet, such as a subject's page. */
  year?: SelectorYear;
  yearOptions: readonly SelectorYearOption[];
  onSubjectChange: (subjectId: SubjectId) => void;
  onYearChange: (year: SelectorYear) => void;
  /** Gives the choices real addresses, so that search engines can follow them. */
  subjectHref?: (subjectId: SubjectId) => string;
  yearHref?: (year: number) => string;
  disabledSubjectIds?: readonly SubjectId[];
  questionPicker?: ReactNode;
  summary?: ReactNode;
  action?: ReactNode;
  ariaLabel: string;
}) {
  return (
    <section className={styles.panel} aria-label={ariaLabel}>
      <div className={styles.body}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.visuallyHidden}>科目</legend>
          <div className={styles.subjectGrid}>
            {subjects.map((subject) => {
              const selected = subject.id === subjectId;
              const disabled = disabledSubjectIds.includes(subject.id);
              const content = (
                <>
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
                </>
              );
              return subjectHref && !disabled ? (
                <InPageLink
                  key={subject.id}
                  className={styles.subjectButton}
                  data-subject={subject.id}
                  aria-current={selected || undefined}
                  href={subjectHref(subject.id)}
                  onFollow={() => onSubjectChange(subject.id)}
                >
                  {content}
                </InPageLink>
              ) : (
                <button
                  key={subject.id}
                  type="button"
                  className={styles.subjectButton}
                  data-subject={subject.id}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => onSubjectChange(subject.id)}
                >
                  {content}
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
              return yearHref && typeof option.value === 'number' && !option.disabled ? (
                <InPageLink
                  key={option.value}
                  className={styles.yearButton}
                  aria-current={selected || undefined}
                  href={yearHref(option.value)}
                  onFollow={() => onYearChange(option.value)}
                >
                  {label}
                </InPageLink>
              ) : (
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
  hrefFor,
  showStatusLegend = false,
}: {
  questions: readonly {
    id: string;
    questionNumber: number;
    label?: ReactNode;
    ariaLabel?: string;
    sheet?: boolean;
    answer?: string;
    stateLabel?: string;
    difficult?: boolean;
    hasContent?: boolean;
  }[];
  value: string;
  onValueChange: (questionId: string) => void;
  /** Makes the tiles real links, so that search engines can follow them. */
  hrefFor?: (questionId: string) => string;
  showStatusLegend?: boolean;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.visuallyHidden}>題號</legend>
      <QuestionNumberGrid>
        {questions.map((question) => (
          <QuestionNumberButton
            key={question.id}
            ariaLabel={question.ariaLabel ?? `第 ${question.questionNumber} 題`}
            active={question.id === value}
            sheet={question.sheet}
            answer={question.answer}
            stateLabel={question.stateLabel}
            difficult={question.difficult}
            hasContent={question.hasContent}
            href={hrefFor?.(question.id)}
            onClick={() => onValueChange(question.id)}
          >
            {question.label ?? question.questionNumber}
          </QuestionNumberButton>
        ))}
      </QuestionNumberGrid>
      {showStatusLegend ? (
        <div
          className={styles.questionStatusLegend}
          role="note"
          aria-label="題號標記說明"
        >
          <span>
            <i data-status="content" aria-hidden="true" />
            有詳解或討論
          </span>
          <span>
            <i data-status="difficult" aria-hidden="true" />
            我的難題
          </span>
        </div>
      ) : null}
    </fieldset>
  );
}
