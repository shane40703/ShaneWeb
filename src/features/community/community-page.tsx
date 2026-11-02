import Image from 'next/image';
import { IconArrowUpRight, IconBrandThreads } from '@tabler/icons-react';
import buttonStyles from '@/components/ui/ui.module.css';
import { threadsProfile } from './community-links';
import styles from './community-page.module.css';

export function CommunityPage() {
  return (
    <section className={styles.page} aria-labelledby="community-title">
      <header className={styles.intro}>
        <span className={styles.eyebrow}>STUDY TOGETHER</span>
        <h2 id="community-title">一起備考，也一起交流。</h2>
        <p>網站更新、備考心得與使用建議，都歡迎到社群聊聊。</p>
      </header>

      <article className={styles.card} aria-labelledby="threads-title">
        <div className={styles.profile}>
          <div className={styles.platform}>
            <span className={styles.icon}><IconBrandThreads size={32} stroke={1.7} aria-hidden="true" /></span>
            <div>
              <h3 id="threads-title">{threadsProfile.name}</h3>
              <p className={styles.handle}>{threadsProfile.handle}</p>
            </div>
          </div>
          <div className={styles.copy}>
            <p className={styles.greeting}>嗨，我是 noki。</p>
            <p>我也是正在準備建築師考試的考生，一邊備考，一邊把自己的練習方式做成這個網站。</p>
            <p>歡迎追蹤、分享解題心得，或告訴我你希望網站變得更好用的地方。</p>
          </div>
          <a
            className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.visit}`}
            href={threadsProfile.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            前往 Threads <IconArrowUpRight size={18} aria-hidden="true" />
            <span className={styles.srOnly}>（另開新分頁）</span>
          </a>
        </div>

        <figure className={styles.qr}>
          <a
            href={threadsProfile.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.qrLink}
            aria-label="開啟 archi.exam_sup 的 Threads 主頁（另開新分頁）"
          >
            <Image
              src={threadsProfile.qrCode}
              alt="Threads 帳號 archi.exam_sup 的 QR Code"
              width={256}
              height={256}
              loading="eager"
              unoptimized
            />
          </a>
          <figcaption>
            <strong>掃描 QR Code，加入交流</strong>
            <span>使用手機瀏覽？直接點上方按鈕即可。</span>
          </figcaption>
        </figure>
      </article>
    </section>
  );
}
