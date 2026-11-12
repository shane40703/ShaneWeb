import Link from 'next/link';
import styles from './privacy-page.module.css';

export function PrivacyPage() {
  return (
    <div className={styles.page}>
      <article className={styles.panel}>
        <header className={styles.section}>
          <p className={styles.updated}>最後更新：115 年 11 月 2 日</p>
          <p>這裡說明本站會保存哪些資料、存在哪裡，以及使用統計怎麼運作。</p>
        </header>

        <section className={styles.section}>
          <h2>存在你的瀏覽器</h2>
          <p>
            作答紀錄、筆記、難題標記、練習進度、歷屆試題討論版上次看到的位置和閱讀、外觀設定，預設只存在你目前使用的瀏覽器，不需要登入。清除瀏覽器資料後就會消失。
          </p>
        </section>

        <section className={styles.section}>
          <h2>登入後同步的資料</h2>
          <p>
            使用 Google 登入後，作答紀錄、文字筆記、難題標記以及字體大小和配色設定會同步到
            Firebase（Google
            的雲端服務），讓你在其他裝置繼續使用。其他使用者看不到這些資料。筆記裡的圖片平常只存在瀏覽器，不會同步；把筆記分享到討論版時，圖片會一起上傳並公開顯示。
          </p>
          <p>
            登入時，Firebase 會保存你 Google 帳號的
            Email、名稱和大頭貼，用來識別帳號；這些資料不會顯示給其他使用者。
          </p>
        </section>

        <section className={styles.section}>
          <h2>你送出的內容</h2>
          <p>
            討論版的投稿和回覆會公開顯示，顯示的是匿名名稱；系統會保存帳號的識別碼，用來確認是作者本人操作，按讚和檢舉也會保存這組識別碼。識別碼不含姓名或
            Email，但技術上可以被讀取，能看出哪些投稿、回覆和按讚來自同一個帳號。過去送出的問題回報仍保存回報類型、題號、說明、來源頁面和帳號識別碼，只有網站維護者看得到。
          </p>
        </section>

        <section className={styles.section}>
          <h2>使用統計</h2>
          <p>
            本站使用 Google Analytics
            了解訪客從哪裡來，以及各種練習方式有多少人使用。Google Analytics
            會在你的瀏覽器存放 Cookie，用來分辨不同的瀏覽器，並收集以下資料：
          </p>
          <ul>
            <li>造訪的頁面、來源網站或連結、停留時間</li>
            <li>裝置和瀏覽器類型、語言、大約地區</li>
            <li>
              寫題、看解答、開始或完成練習、下載紙本練習卷的次數，以及當時的練習方式和科目
            </li>
          </ul>
          <p>
            這些資料不包含你的帳號、Email、題號、答案、分數、筆記或討論內容。本站沒有開啟
            Google Analytics 的廣告功能。
          </p>
          <p>
            歷屆試題討論版的網址含有科目、年度和題號，本站送出的統計資料一律記成「歷屆試題討論版」這一頁。不過
            Google 的統計程式偶爾會回傳自己的運作紀錄，裡面可能帶有你打開的頁面網址，這部分由 Google 處理。
          </p>
          <p>
            <a
              href="https://policies.google.com/technologies/partner-sites?hl=zh-TW"
              target="_blank"
              rel="noreferrer"
            >
              Google 如何使用這些資料 ↗
            </a>
          </p>
        </section>

        <section className={styles.section}>
          <h2>不想被統計</h2>
          <p>
            可以安裝 Google 提供的{' '}
            <a
              href="https://tools.google.com/dlpage/gaoptout?hl=zh-TW"
              target="_blank"
              rel="noreferrer"
            >
              Google Analytics 停用外掛 ↗
            </a>
            ，或使用會阻擋統計工具的瀏覽器擴充功能。兩種方式都不影響網站功能。
          </p>
        </section>

        <section className={styles.section}>
          <h2>聯絡方式</h2>
          <p>
            對隱私權有疑問，或想刪除雲端上的資料，請到{' '}
            <Link href="/threads">Threads</Link>
            {' '}告訴我們。本政策更新時會修改上方日期。
          </p>
        </section>
      </article>
    </div>
  );
}
