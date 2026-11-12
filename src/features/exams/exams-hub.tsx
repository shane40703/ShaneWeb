import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';
import { EmptyState } from '@/components/content/content';
import { InPageLink } from '@/components/in-page-link';
import { SubjectIconBadge } from '@/components/subject-icon';
import { Button } from '@/components/ui/ui';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import {
  examsHref,
  examsPlaceSlug,
  examsQuestionHref,
  examsSlug,
  type ExamsPlace,
} from '@/lib/question-path';
import { comparePaperQuestionOrder, formatQuestionNumberLabel } from '@/lib/study';
import type { SubjectId } from '@/lib/types';
import { getSubject, subjects } from '@/question-bank/catalog';
import {
  buildPaperIndex,
  paperFacts,
  paperTopicsFor,
  topLabels,
  type PaperFacts,
  type PaperTopics,
  type QuestionEntry,
} from '@/question-bank/derived-data';
import {
  countWord,
  formatCount,
  joinWithAnd,
  questionCounts,
  yearRange,
} from './exams-head';
import styles from './exams-hub.module.css';

export type ExamsHubPlace = Exclude<ExamsPlace, { kind: 'question' }>;

const PAPER_TOPICS = 3;

/** 「100–114 年」「15 份」「申論題 37 題」「選擇題 600 題」 */
function subjectFigure(facts: PaperFacts) {
  const years =
    facts.firstYear === facts.lastYear
      ? `${facts.firstYear} 年`
      : `${facts.firstYear}–${facts.lastYear} 年`;
  return [years, `${formatCount(facts.papers)} 份`, ...questionCounts(facts)];
}

/** A row's figure, its parts joined by ・: a narrow row breaks it only between the parts. */
function Figure({ parts }: { parts: readonly string[] }) {
  return (
    <p className={styles.figure}>
      {parts.map((part, position) => (
        <Fragment key={part}>
          {position ? '・' : null}
          <span className={styles.keep}>{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

/** In running text, a count stays on one line: 「3,672 題」「選擇題 80 題」「（21 題）」. */
function keepCounts(text: string) {
  return text.split(/((?:申論題 |選擇題 )?\d[\d,]* [題份年])/).map((part, position) =>
    position % 2 ? (
      <span key={position} className={styles.keep}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function bankLead(facts: PaperFacts) {
  const total = formatCount(facts.written + facts.multipleChoice);
  const written = facts.written ? `，其中申論題 ${formatCount(facts.written)} 題` : '';
  return (
    `建築師考試（專門職業及技術人員高等考試建築師考試）${countWord(facts.subjects.length)}個科目的歷屆試題：` +
    `${yearRange(facts)}，共 ${formatCount(facts.papers)} 份試卷、${total} 題${written}。` +
    '每一題都有自己的頁面，可以先作答再看解答，也能在討論區留下詳解或提問。' +
    '在上方選一個科目，就從那一科最新一年的第 1 題開始。'
  );
}

function subjectLead(subjectId: SubjectId, facts: PaperFacts) {
  const subject = getSubject(subjectId);
  const everyYear =
    facts.firstYear !== undefined &&
    facts.lastYear !== undefined &&
    facts.papers === facts.lastYear - facts.firstYear + 1;
  const counts = questionCounts(facts);
  return (
    `${subject?.name}（${subject?.shortName}）：${subject?.description}。` +
    `${yearRange(facts)}${everyYear ? '每年一份試卷，' : ''}共 ${formatCount(facts.papers)} 份` +
    `${counts.length > 1 ? '，' : '、'}${counts.join('、')}。` +
    '在上方選一個年度，就從那一年的第 1 題開始。'
  );
}

function paperLead(
  subjectId: SubjectId,
  year: number,
  facts: PaperFacts,
  topics: PaperTopics | null,
) {
  const subject = getSubject(subjectId);
  const top = topics ? topLabels(topics.rows, PAPER_TOPICS) : [];
  const most = top.length
    ? `考得最多的是${joinWithAnd(top.map(([label, count]) => `${label}（${count} 題）`))}。`
    : '';
  return (
    `民國 ${year} 年建築師考試${subject?.name}（${subject?.shortName}）試卷，${questionCounts(facts).join('、')}。` +
    `${most}點任一題就能作答、看解答和討論。`
  );
}

/**
 * One row of a ledger: what a subject or a paper holds, under its name. Not a link: the
 * selector above the page opens subjects and years, and one page has one way to each.
 */
function LedgerRow({
  title,
  kind,
  subject,
  aside,
  children,
}: {
  title: string;
  kind: 'subject' | 'paper';
  /** A subject row carries its icon. */
  subject?: SubjectId;
  /** Beside the title: a subject's short name. */
  aside?: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <article className={styles.row} data-kind={kind} aria-labelledby={titleId}>
      {subject ? <SubjectIconBadge subject={subject} className={styles.badge} /> : null}
      <h2 id={titleId} className={styles.rowTitle}>
        {title}
        {aside ? (
          <>
            {' '}
            <span className={styles.shortName}>{aside}</span>
          </>
        ) : null}
      </h2>
      {children}
    </article>
  );
}

function QuestionRows({
  questions,
  labels,
  onNavigate,
  twoColumns,
}: {
  questions: readonly QuestionEntry[];
  labels: ReadonlyMap<string, readonly string[]> | null;
  onNavigate: (slug: readonly string[]) => void;
  twoColumns: boolean;
}) {
  return (
    <ol
      className={styles.questions}
      data-columns={twoColumns ? 2 : undefined}
      style={{ '--rows': Math.ceil(questions.length / 2) } as CSSProperties}
    >
      {questions.map((question) => (
        <li key={question.id}>
          <InPageLink
            href={examsQuestionHref(question.id)}
            className={styles.question}
            onFollow={() => onNavigate(examsSlug(question.id))}
          >
            <span className={styles.number}>{formatQuestionNumberLabel(question)}</span>{' '}
            <span className={styles.labels}>{labels?.get(question.id)?.join('、')}</span>
          </InPageLink>
        </li>
      ))}
    </ol>
  );
}

/**
 * 歷屆試題討論版's overview pages, under the subject and year selector that the page puts at the
 * top of every address: the four subjects, a subject's papers, a paper's questions. The board
 * and a subject list their rows as facts, a short description and a figure, which are not links:
 * the selector chooses. A paper lists each question as a link to it, with its topics. Nothing
 * else: no question's text, nothing of the reader's own.
 *
 * The paper page's topic words are the ones the question page shows as tags. A prerendered page
 * has them already; after a move inside the page they come with the paper's file, which the
 * page downloads anyway so that its first question opens at once.
 */
export function ExamsHub({
  place,
  questions,
  paperTopics,
  status,
  onRetry,
  onNavigate,
  focusLead = false,
}: {
  place: ExamsHubPlace;
  /** Every question of the bank, with a body once its paper has loaded. */
  questions: readonly QuestionEntry[];
  /** The prerendered paper page's topics. */
  paperTopics?: PaperTopics | null;
  status: QuestionBankStatus;
  onRetry?: () => void;
  /** A paper's row to its question: a new history entry, from the top of the page. */
  onNavigate: (slug: readonly string[]) => void;
  /** Arrived here by a move inside the page: start keyboard and screen readers at the lead. */
  focusLead?: boolean;
}) {
  const leadRef = useRef<HTMLParagraphElement>(null);
  const index = useMemo(() => buildPaperIndex(questions), [questions]);
  const placeKey = examsHref(examsPlaceSlug(place));

  useEffect(() => {
    if (focusLead) leadRef.current?.focus({ preventScroll: true });
  }, [focusLead, placeKey]);

  const lead = (text: string) => (
    <p ref={leadRef} className={styles.intro} tabIndex={-1}>
      {keepCounts(text)}
    </p>
  );

  if (place.kind === 'bank') {
    const facts = paperFacts(index);
    if (!facts.papers) {
      return (
        <EmptyState title="題庫尚無資料" description="加入題目後即可使用詳解與討論。" />
      );
    }
    return (
      <div className={styles.hub}>
        {lead(bankLead(facts))}
        <ul className={styles.ledger}>
          {subjects
            .filter((subject) => facts.subjects.includes(subject.id))
            .map((subject) => (
              <li key={subject.id}>
                <LedgerRow
                  kind="subject"
                  subject={subject.id}
                  title={subject.name}
                  aside={subject.shortName}
                >
                  <p className={styles.description}>{subject.description}</p>
                  <Figure parts={subjectFigure(paperFacts(index, subject.id))} />
                </LedgerRow>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  if (place.kind === 'subject') {
    const facts = paperFacts(index, place.subject);
    const papers = index[place.subject] ?? [];
    if (!papers.length) {
      return (
        <EmptyState
          title="找不到這個科目"
          description="這一頁可能已移除，請用上方的科目、年度按鈕重新選擇。"
        />
      );
    }
    return (
      <div className={styles.hub}>
        {lead(subjectLead(place.subject, facts))}
        <ul className={styles.ledger}>
          {papers.map(([year, multipleChoice, written]) => (
            <li key={year}>
              <LedgerRow kind="paper" title={`${year} 年`}>
                <Figure parts={questionCounts({ written, multipleChoice })} />
              </LedgerRow>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <PaperHub
      place={place}
      facts={paperFacts(index, place.subject, place.year)}
      questions={questions}
      paperTopics={paperTopics}
      status={status}
      onRetry={onRetry}
      onNavigate={onNavigate}
      lead={lead}
    />
  );
}

function PaperHub({
  place,
  facts,
  questions,
  paperTopics,
  status,
  onRetry,
  onNavigate,
  lead,
}: {
  place: Extract<ExamsPlace, { kind: 'paper' }>;
  facts: PaperFacts;
  questions: readonly QuestionEntry[];
  paperTopics?: PaperTopics | null;
  status: QuestionBankStatus;
  onRetry?: () => void;
  onNavigate: (slug: readonly string[]) => void;
  lead: (text: string) => ReactNode;
}) {
  const { subject, year } = place;
  const paper = useMemo(
    () =>
      questions
        .filter((question) => question.subject === subject && question.year === year)
        .sort(comparePaperQuestionOrder),
    [questions, subject, year],
  );
  const topics = useMemo(
    () => paperTopicsFor(subject, year, paperTopics, questions),
    [subject, year, paperTopics, questions],
  );
  const labels = useMemo(() => (topics ? new Map(topics.rows) : null), [topics]);
  if (!paper.length) {
    return (
      <EmptyState
        title="找不到這份試卷"
        description="這一頁可能已移除，請用上方的科目、年度按鈕重新選擇。"
      />
    );
  }
  const written = paper.filter((question) => question.format === 'written');
  const multipleChoice = paper.filter((question) => question.format !== 'written');

  return (
    <div className={styles.hub}>
      {lead(paperLead(subject, year, facts, topics))}
      {/* One live region while the topics are missing: a failure is announced as a change. */}
      {topics ? null : (
        <div className={styles.status}>
          <p role="status">
            {status === 'error' ? '考點暫時無法載入。' : '正在載入考點…'}
          </p>
          {status === 'error' && onRetry ? (
            <Button variant="ghost" onClick={onRetry}>
              重新載入
            </Button>
          ) : null}
        </div>
      )}
      <div className={styles.paper} data-written={written.length ? true : undefined}>
        <div className={styles.columnHead} aria-hidden="true">
          <span>題號</span>
          <span>考點</span>
        </div>
        {written.length ? (
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>
              申論題 <span>{formatCount(written.length)} 題</span>
            </h2>
            <QuestionRows
              questions={written}
              labels={labels}
              onNavigate={onNavigate}
              twoColumns={false}
            />
          </section>
        ) : null}
        {multipleChoice.length ? (
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>
              選擇題 <span>{formatCount(multipleChoice.length)} 題</span>
            </h2>
            <QuestionRows
              questions={multipleChoice}
              labels={labels}
              onNavigate={onNavigate}
              twoColumns
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
