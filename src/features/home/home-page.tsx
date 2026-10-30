import Link from 'next/link';
import { IconArrowRight, IconCalendarEvent } from '@tabler/icons-react';
import { SubjectIconBadge } from '@/components/subject-icon';
import { mockExamHref } from '@/features/practice/mock-exam';
import { practiceQuizPage } from '@/features/practice/practice-pages';
import { subjects } from '@/question-bank/catalog';
import { ActivityHeatmapSection } from './activity-heatmap-panel';
import { ARCHITECT_EXAM, getExamCountdown, useTaipeiDate } from './exam-countdown';
import styles from './home-page.module.css';

export function HomePage({ today }: { today?: string }) {
  const currentDate = useTaipeiDate();
  const date = today ?? currentDate;
  const countdown = date ? getExamCountdown(date) : null;
  return (
    <section className={styles.home} aria-label="選擇練習科目">
      <section className={styles.examCountdown} aria-labelledby="exam-countdown-title">
        <div className={styles.examIntro}>
          <span className={styles.eyebrow}><IconCalendarEvent size={18} aria-hidden="true" /> EXAM COUNTDOWN</span>
          <h2 id="exam-countdown-title">{ARCHITECT_EXAM.name}</h2>
          <p><time dateTime={ARCHITECT_EXAM.startsOn}>2026 年 11 月 14 日</time> 至 <time dateTime={ARCHITECT_EXAM.endsOn}>11 月 16 日</time></p>
          <a href={ARCHITECT_EXAM.source} target="_blank" rel="noreferrer">考選部考試日程 ↗</a>
        </div>
        <div className={styles.countdownValue} aria-live="polite" aria-atomic="true">
          {countdown?.phase === 'finished' ? <strong className={styles.examStatus}>本次考試已結束</strong> : <>
            <span>{countdown?.phase === 'ongoing' ? '考試進行中・第' : '距離考試還有'}</span>
            <p><strong>{countdown?.days ?? '—'}</strong><span>天</span></p>
          </>}
          <small>以臺灣日期計算{countdown?.phase === 'before' ? '・倒數至第一天' : ''}</small>
        </div>
      </section>
      <ActivityHeatmapSection today={date} />
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
