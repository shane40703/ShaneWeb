import Image from 'next/image';
import type { ReactNode } from 'react';
import { IconArrowUpRight, IconBrandLine, IconBrandThreads } from '@tabler/icons-react';
import buttonStyles from '@/components/ui/ui.module.css';
import { lineCommunity, threadsProfile } from './community-links';
import styles from './community-page.module.css';

type CommunityCardContent = {
  /** Prefix of the heading id that labels the card; unique per card. */
  id: string;
  link: { name: string; handle: string; href: string; qrCode: string };
  icon: ReactNode;
  greeting?: string;
  paragraphs?: readonly string[];
  /** Short lines read together as one list (what the LINE community is for). */
  items?: readonly string[];
  action: string;
  qrLabel: string;
  qrAlt: string;
  qrCaption: string;
};

const cards: readonly CommunityCardContent[] = [
  {
    id: 'threads',
    link: threadsProfile,
    icon: <IconBrandThreads size={32} stroke={1.7} aria-hidden="true" />,
    greeting: '嗨，我是 noki。',
    paragraphs: [
      '我也是正在準備建築師考試的考生，一邊備考，一邊把自己的練習方式做成這個網站。',
      '歡迎追蹤、分享解題心得。',
    ],
    action: '前往 Threads',
    qrLabel: '開啟 archi.exam_sup 的 Threads 主頁（另開新分頁）',
    qrAlt: 'Threads 帳號 archi.exam_sup 的 QR Code',
    qrCaption: '掃描 QR Code，加入交流',
  },
  {
    id: 'line',
    link: lineCommunity,
    icon: <IconBrandLine size={32} stroke={1.7} aria-hidden="true" />,
    items: [
      '想要什麼新功能，進來許願',
      '用的時候遇到錯誤，進來說一聲',
      '對網站開發有興趣，一起來協作',
      '交流考試內容，互相解惑',
    ],
    action: '加入 LINE 社群',
    qrLabel: '開啟 LINE 社群「建築師大集結開源討論群」的邀請頁（另開新分頁）',
    qrAlt: 'LINE 社群的 QR Code',
    qrCaption: '掃描 QR Code，加入 LINE 社群',
  },
];

export function CommunityPage() {
  return (
    <section className={styles.page} aria-labelledby="community-title">
      <header className={styles.intro}>
        <span className={styles.eyebrow}>STUDY TOGETHER</span>
        <h2 id="community-title">一起備考，也一起交流。</h2>
        <p>在 Threads 追蹤網站動態；想交流考試內容、一起把網站做得更好，歡迎加入 LINE 社群。</p>
      </header>

      {cards.map(card => <CommunityCard key={card.id} card={card} />)}
    </section>
  );
}

function CommunityCard({ card }: { card: CommunityCardContent }) {
  const { link } = card;
  const titleId = `${card.id}-title`;
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.profile}>
        <div className={styles.platform}>
          <span className={styles.icon}>{card.icon}</span>
          <div>
            <h3 id={titleId}>{link.name}</h3>
            <p className={styles.handle}>{link.handle}</p>
          </div>
        </div>
        <div className={styles.copy}>
          {card.greeting ? <p className={styles.greeting}>{card.greeting}</p> : null}
          {card.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          {card.items ? (
            <ul className={styles.items}>
              {card.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </div>
        <a
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.visit}`}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {card.action} <IconArrowUpRight size={18} aria-hidden="true" />
          <span className={styles.srOnly}>（另開新分頁）</span>
        </a>
      </div>

      <figure className={styles.qr}>
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.qrLink}
          aria-label={card.qrLabel}
        >
          <Image
            src={link.qrCode}
            alt={card.qrAlt}
            width={256}
            height={256}
            loading="eager"
            unoptimized
          />
        </a>
        <figcaption>
          <strong>{card.qrCaption}</strong>
          <span>使用手機瀏覽？直接點上方按鈕即可。</span>
        </figcaption>
      </figure>
    </article>
  );
}
