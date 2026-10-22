import Link from 'next/link';
import { useRouter } from 'next/router';
import { useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { IconArrowRight, IconChevronRight } from '@tabler/icons-react';
import { SubjectIconBadge } from '@/components/subject-icon';
import {
  CLOZE_STORAGE_KEY,
  parseClozeRoundProgress,
} from '@/features/law-cloze/cloze-progress';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { useClientReady } from '@/lib/use-client-ready';
import { getSubject } from '@/question-bank/catalog';
import type { PracticeOverview } from './practice-overview';
import {
  practiceClozePage,
  practiceQuizPage,
  type PracticeHubPageLink,
} from './practice-pages';
import { readKeptPracticeResult } from './practice-result-memory';
import {
  hasPracticeProgress,
  parsePracticeSession,
  PRACTICE_PATH,
  PRACTICE_SESSION_STORAGE_KEY,
  practiceQuestionHref,
  summarizePractice,
  type PracticeSession,
} from './practice-session';
import styles from './practice-hub-page.module.css';

const numberFormat = new Intl.NumberFormat('zh-TW');

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/** A saved value that follows other tabs' writes; null while the page is prerendered. */
function useStoredValue(key: string) {
  return useSyncExternalStore(
    subscribeToStorage,
    () => readStoredValue(key),
    () => null,
  );
}

function setName(session: PracticeSession) {
  return [
    getSubject(session.subject)?.shortName,
    session.category === 'all' ? null : session.category,
    `${session.questionIds.length} 題`,
  ]
    .filter(Boolean)
    .join('・');
}

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <span className={styles.meter} aria-hidden="true">
      <span style={{ width: `${Math.round((value / max) * 100)}%` }} />
    </span>
  );
}

function PracticeCard({
  page,
  stat,
  prefetch,
  children,
}: {
  page: PracticeHubPageLink;
  stat: string;
  prefetch?: false;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.cardHeader}>
        <span className={styles.cardIcon} aria-hidden="true">
          <page.icon size={24} stroke={1.8} />
        </span>
        <h2 id={titleId}>
          <Link href={page.href} prefetch={prefetch} className={styles.cardLink}>
            {page.label}
          </Link>
        </h2>
        <p>{page.summary}</p>
      </header>
      <div className={styles.cardBody}>{children}</div>
      <footer className={styles.cardFooter}>
        <span>{stat}</span>
        <span className={styles.cardAction} aria-hidden="true">
          進入{page.label}
          <IconArrowRight size={16} stroke={2.2} />
        </span>
      </footer>
    </article>
  );
}

function QuizShortcut({ subjects }: { subjects: PracticeOverview['subjects'] }) {
  const session = parsePracticeSession(useStoredValue(PRACTICE_SESSION_STORAGE_KEY));
  // Only this tab's memory has it, and only until a reload, like the result page.
  const result = readKeptPracticeResult(session);

  if (result) {
    const { answered, correct, accuracy } = result.summary;
    return (
      <>
        <p className={styles.quickLabel}>剛交卷</p>
        <div className={styles.status}>
          <strong>{setName(result.session)}</strong>
          <span>
            {accuracy === null
              ? '這次沒有確認任何答案'
              : `答對 ${correct}／${answered} 題・正確率 ${accuracy}%`}
          </span>
        </div>
        <Link
          href={{ pathname: PRACTICE_PATH, query: { view: 'result' } }}
          className={styles.resume}
        >
          看結果
          <IconArrowRight size={17} stroke={2.2} aria-hidden="true" />
        </Link>
      </>
    );
  }

  if (session) {
    const { total, answered, correct } = summarizePractice(session);
    const started = hasPracticeProgress(session);
    return (
      <>
        <p className={styles.quickLabel}>{started ? '進行中的題組' : '抽好的題組'}</p>
        <div className={styles.status}>
          <strong>{setName(session)}</strong>
          <span>
            {answered
              ? `已作答 ${answered}／${total} 題・答對 ${correct} 題`
              : '還沒有確認答案'}
          </span>
          <Meter value={answered} max={total} />
        </div>
        <Link href={practiceQuestionHref(session.currentIndex)} className={styles.resume}>
          {started ? `繼續第 ${session.currentIndex + 1} 題` : '開始作答'}
          <IconArrowRight size={17} stroke={2.2} aria-hidden="true" />
        </Link>
      </>
    );
  }

  return (
    <>
      <p className={styles.quickLabel}>選科目開始</p>
      <div className={styles.subjectLinks}>
        {subjects.map(({ subject, count }) => {
          const content = (
            <>
              <SubjectIconBadge subject={subject} />
              <strong>{getSubject(subject)?.name}</strong>{' '}
              <small>{count ? `${numberFormat.format(count)} 題` : '準備中'}</small>
            </>
          );
          return count ? (
            <Link
              key={subject}
              href={{ pathname: PRACTICE_PATH, query: { subject } }}
              className={styles.subjectLink}
            >
              {content}
              <IconChevronRight size={16} stroke={2} aria-hidden="true" />
            </Link>
          ) : (
            <span key={subject} className={`${styles.subjectLink} ${styles.unavailable}`}>
              {content}
            </span>
          );
        })}
      </div>
    </>
  );
}

function ClozeShortcut() {
  const router = useRouter();
  const raw = useStoredValue(CLOZE_STORAGE_KEY);
  const [starting, setStarting] = useState(false);
  const progress = parseClozeRoundProgress(raw);

  async function startNextRound() {
    setStarting(true);
    try {
      // Only this button needs the bank; the hub itself never loads it.
      const cloze = await import('@/features/law-cloze/cloze');
      const round = cloze.parseClozeSession(readStoredValue(CLOZE_STORAGE_KEY));
      if (round && cloze.summarizeClozeRound(round).complete) {
        const { lawId, category, count } = round;
        writeStoredValue(
          CLOZE_STORAGE_KEY,
          cloze.serializeClozeSession(
            cloze.createClozeSession({ lawId, category, count }),
          ),
        );
      }
    } catch {
      // The page still opens, on the finished round.
    }
    const moved = await router.push(practiceClozePage.href).catch(() => false);
    if (!moved) setStarting(false);
  }

  if (!raw) {
    return (
      <>
        <p className={styles.quickLabel}>還沒開始</p>
        <p className={styles.quickText}>每輪隨機抽題，直接在條文的空格裡填數字。</p>
        <Link href={practiceClozePage.href} prefetch={false} className={styles.resume}>
          開始練習
          <IconArrowRight size={17} stroke={2.2} aria-hidden="true" />
        </Link>
      </>
    );
  }

  if (!progress) {
    // Saved before the page kept these figures; the page adds them on the next visit.
    return (
      <>
        <p className={styles.quickLabel}>本輪進度</p>
        <p className={styles.quickText}>上次的練習還保留著，可以接著做。</p>
        <Link href={practiceClozePage.href} prefetch={false} className={styles.resume}>
          繼續練習
          <IconArrowRight size={17} stroke={2.2} aria-hidden="true" />
        </Link>
      </>
    );
  }

  const { total, submitted, correct, revealed, complete } = progress;

  if (complete) {
    return (
      <>
        <p className={styles.quickLabel}>本輪完成</p>
        <div className={styles.status}>
          <strong>
            {submitted ? `${submitted} 題中全對 ${correct} 題` : '本輪沒有提交作答'}
          </strong>
          {revealed ? <span>直接看答案 {revealed} 題，不計分</span> : null}
          <Meter value={total} max={total} />
        </div>
        <button
          type="button"
          className={styles.resume}
          disabled={starting}
          onClick={() => void startNextRound()}
        >
          {starting ? '正在抽題…' : '再練一輪'}
          <IconArrowRight size={17} stroke={2.2} aria-hidden="true" />
        </button>
      </>
    );
  }

  const done = submitted + revealed;
  return (
    <>
      <p className={styles.quickLabel}>本輪進度</p>
      <div className={styles.status}>
        <strong>
          {done
            ? `已完成 ${done}／${total} 題・全對 ${correct} 題`
            : `本輪 ${total} 題，還沒開始作答`}
        </strong>
        {revealed ? <span>其中 {revealed} 題直接看答案，不計分</span> : null}
        <Meter value={done} max={total} />
      </div>
      <Link href={practiceClozePage.href} prefetch={false} className={styles.resume}>
        {done ? '繼續本輪' : '開始本輪'}
        <IconArrowRight size={17} stroke={2.2} aria-hidden="true" />
      </Link>
    </>
  );
}

export function PracticeHubPage({ overview }: { overview: PracticeOverview }) {
  const ready = useClientReady();
  const questionTotal = overview.subjects.reduce((total, item) => total + item.count, 0);
  // Progress is saved in this browser, so the prerendered page shows neither card's yet.
  const pending = <p className={styles.pending}>正在讀取練習進度…</p>;

  return (
    <div className={styles.hub}>
      <p className={styles.intro}>每天練一點：選擇題熟悉考法，克漏字背熟法規數字。</p>
      <ul className={styles.cards}>
        <li>
          <PracticeCard
            page={practiceQuizPage}
            stat={`${overview.subjects.length} 科・${numberFormat.format(questionTotal)} 題`}
          >
            {ready ? <QuizShortcut subjects={overview.subjects} /> : pending}
          </PracticeCard>
        </li>
        <li>
          {/* The cloze page carries the whole statute bank: fetch it on intent only. */}
          <PracticeCard
            page={practiceClozePage}
            prefetch={false}
            stat={`${overview.cloze.laws} 部法規・${numberFormat.format(overview.cloze.questions)} 題`}
          >
            {ready ? <ClozeShortcut /> : pending}
          </PracticeCard>
        </li>
      </ul>
    </div>
  );
}
