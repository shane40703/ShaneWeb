import Link from 'next/link';
import { IconArrowRight, IconCalendarEvent } from '@tabler/icons-react';
import { SubjectIconBadge } from '@/components/subject-icon';
import { mockExamHref } from '@/features/practice/mock-exam';
import { practiceQuizPage } from '@/features/practice/practice-pages';
import { subjects } from '@/question-bank/catalog';
import { getExamCountdown, useTaipeiDate } from './exam-countdown';
import styles from './home-page.module.css';

function examDate(value: string, includeYear = false) {
  const [year, month, day] = value.split('-').map(Number);
  return `${includeYear ? `${year} 年 ` : ''}${month} 月 ${day} 日`;
}

export function HomePage({ today }: { today?: string }) {
  const currentDate = useTaipeiDate();
  const date = today ?? currentDate;
  const countdown = date ? getExamCountdown(date) : null;
  const exam = countdown?.exam;
  return (
    <section className={styles.home} aria-label="選擇練習科目">
      <section className={styles.examCountdown} aria-labelledby="exam-countdown-title">
        <div className={styles.examIntro}>
          <span className={styles.eyebrow}><IconCalendarEvent size={18} aria-hidden="true" /> EXAM COUNTDOWN</span>
          <h2 id="exam-countdown-title">{exam?.name ?? '建築師考試'}</h2>
          {exam ? <p>
            <time dateTime={exam.startsOn}>{examDate(exam.startsOn, true)}</time> 至 <time dateTime={exam.endsOn}>{examDate(exam.endsOn)}</time>
            {exam.estimated ? <span className={styles.estimate}>預估日期，請以考選部公告為準</span> : null}
          </p> : <p>正在讀取考試日期…</p>}
          {exam ? <a href={exam.source} target="_blank" rel="noreferrer">考選部考試日程 ↗</a> : null}
        </div>
        <div className={styles.countdownValue} aria-live="polite" aria-atomic="true">
          {countdown?.phase === 'ongoing' ? <>
            <strong className={styles.examStatus}>{exam?.estimated ? '預估考期' : '舉行中'}</strong>
            <span className={styles.examWish}>願你沉著應試，發揮實力，順利上榜！</span>
          </> : <>
            <span>距離考試還有</span>
            <p><strong>{countdown?.days ?? '—'}</strong><span>天</span></p>
          </>}
          <small>以臺灣日期計算{countdown?.phase === 'before' ? '・倒數至第一天' : countdown?.phase === 'ongoing' ? `・第 ${countdown.days} 天` : ''}</small>
        </div>
      </section>
      <Link href={practiceQuizPage.href} className={styles.practiceShortcut}>
        <span><strong>{practiceQuizPage.label}</strong><small>重新選科、隨機抽題，逐題對答案</small></span>
        <span>開始練習 <IconArrowRight size={20} aria-hidden="true" /></span>
      </Link>
      <div className={styles.subjectGrid}>
        {subjects.map((subject, index) => (
          <Link
            key={subject.id}
            href={mockExamHref({ subject: subject.id })}
            className={styles.subjectCard}
            data-subject={subject.id}
          >
            <span className={styles.cardNumber}>0{index + 1}</span>
            <SubjectIconBadge
              subject={subject.id}
              size="large"
              className={styles.subjectIcon}
            />
            <h2>{subject.name}</h2>
            <span className={styles.cardAction}>
              選擇年份 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
