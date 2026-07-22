'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/ui';
import { subjects, years } from '@/data/questions';
import { getStudyStats } from '@/lib/study';
import { useAppState } from '@/state/app-state';
import styles from './home-page.module.css';

const statCards = [
  { key: 'total', label: '題庫總數', symbol: '▤', tone: 'blue', suffix: '示範題' },
  { key: 'answered', label: '已作答題數', symbol: '✓', tone: 'green', suffix: '持續累積' },
  { key: 'difficult', label: '難題標記', symbol: '★', tone: 'orange', suffix: '等待複習' },
  { key: 'accuracy', label: '平均正確率', symbol: '↗', tone: 'purple', suffix: '依作答更新' },
] as const;

export function HomePage() {
  const { state } = useAppState();
  const stats = getStudyStats(state);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>民國 102～114 年歷屆試題</span>
          <h1>
            把每一次練習
            <br />
            變成穩定的進步
          </h1>
          <p>集中練習四大科目、追蹤答題表現，從熟悉題型到掌握考點，建立自己的備考節奏。</p>
          <div className={styles.heroActions}>
            <Button variant="primary" render={<Link href="/papers" />}>
              開始練習 <span aria-hidden="true">→</span>
            </Button>
            <Button render={<Link href="/practice" />}>隨機出題</Button>
          </div>
          <div className={styles.heroFootnote}>
            <span aria-hidden="true">◎</span> 不需登入，紀錄只保留在這台裝置
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.blueprintGrid} />
          <div className={styles.annotation}>A–01 / STUDY PLAN</div>
          <div className={styles.building}>
            <div className={styles.roof} />
            <div className={styles.floor} data-floor="3" />
            <div className={styles.floor} data-floor="2" />
            <div className={styles.floor} data-floor="1" />
            <span className={styles.column} data-column="1" />
            <span className={styles.column} data-column="2" />
            <span className={styles.column} data-column="3" />
            <span className={styles.column} data-column="4" />
          </div>
          <div className={styles.measureLine}>12.00 M</div>
        </div>
      </section>

      <section className={styles.statsGrid} aria-label="學習概況">
        {statCards.map((card) => {
          const value = stats[card.key];
          return (
            <article key={card.key} className={styles.statCard}>
              <span className={styles.statIcon} data-tone={card.tone} aria-hidden="true">
                {card.symbol}
              </span>
              <div>
                <small>{card.label}</small>
                <strong>
                  {value}
                  {card.key === 'accuracy' ? '%' : ''}
                </strong>
                <span>
                  {card.key === 'answered' ? `完成度 ${stats.completion}%` : card.suffix}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <div className={styles.contentGrid}>
        <div>
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>SUBJECTS</span>
              <h2>考試科目</h2>
            </div>
          </header>
          <section className={styles.subjectGrid} aria-label="考試科目">
            {subjects.map((subject, index) => (
              <article className={styles.subjectCard} key={subject.id}>
                <span className={styles.subjectNumber}>0{index + 1}</span>
                <span className={styles.subjectSymbol} data-subject={subject.id}>
                  {subject.symbol}
                </span>
                <h3>{subject.name}</h3>
                <p>{subject.description}</p>
                <footer>
                  <strong>5 題示範題</strong>
                  <Link href={`/papers?subject=${subject.id}`}>瀏覽題庫 →</Link>
                </footer>
              </article>
            ))}
          </section>

          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>PAST EXAMS</span>
              <h2>依年度瀏覽</h2>
            </div>
            <Link href="/papers" className={styles.textLink}>
              查看全部 →
            </Link>
          </header>
          <div className={styles.yearList}>
            {years.map((year) => (
              <Link key={year} href={`/papers?year=${year}`} className={styles.yearLink}>
                <span>{year}</span> 年
              </Link>
            ))}
          </div>
        </div>

        <aside className={styles.rightRail}>
          <article className={styles.panelCard}>
            <span className={styles.eyebrow}>TODAY&apos;S PLAN</span>
            <h2>今天先完成 10 題</h2>
            <p>不用一次準備完所有範圍。每天累積一點，讓答題速度與準確率穩定提升。</p>
            <div className={styles.planSteps}>
              <div>
                <span>01</span>
                <p>選擇熟悉的科目暖身</p>
              </div>
              <div>
                <span>02</span>
                <p>把答錯題目加入難題</p>
              </div>
              <div>
                <span>03</span>
                <p>隔天再次練習確認</p>
              </div>
            </div>
            <Button variant="primary" fullWidth render={<Link href="/practice" />}>
              立即開始
            </Button>
          </article>
          <article className={styles.tipCard}>
            <span className={styles.tipIcon}>i</span>
            <div>
              <strong>學習提醒</strong>
              <p>答案會保留在你的瀏覽器；清除網站資料後將無法復原。</p>
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}
