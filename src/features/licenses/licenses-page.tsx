import type { ReactNode } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { countByLicense, type ThirdPartyPackage } from '@/lib/third-party-licenses';
import styles from './licenses-page.module.css';

export const SOURCE_CODE_URL = 'https://github.com/shane40703/ShaneWeb';
export const AGPL_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/** A package as the page gets it: its licence text is a place in ThirdPartyList.licenseTexts. */
export type ListedPackage = Omit<ThirdPartyPackage, 'licenseText'> & {
  licenseText: number;
};

/** The build's package list, dated for the page. */
export interface ThirdPartyList {
  /** 「115 年 11 月 11 日」 */
  updated: string;
  packages: ListedPackage[];
  /** Each distinct text once: the Firebase packages share one Apache-2.0 text, for example. */
  licenseTexts: string[];
}

/** The page's props from the build's list, sending each shared licence text only once. */
export function thirdPartyList(
  updated: string,
  packages: readonly ThirdPartyPackage[],
): ThirdPartyList {
  const licenseTexts: string[] = [];
  const places = new Map<string, number>();
  const listed = packages.map(({ licenseText, ...item }) => {
    if (!places.has(licenseText)) {
      places.set(licenseText, licenseTexts.length);
      licenseTexts.push(licenseText);
    }
    return { ...item, licenseText: places.get(licenseText)! };
  });
  return { updated, packages: listed, licenseTexts };
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className={styles.srOnly}>（另開新分頁）</span>
    </a>
  );
}

/** github.com/facebook/react, without the scheme and trailing slash. */
function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** The blank the SPDX MIT text leaves for the copyright line. */
const COPYRIGHT_BLANK = '<year> <copyright holders>';

/**
 * The SPDX MIT text is hard-wrapped at about 100 columns, wider than the text box, so each line
 * would wrap a second time. Join those wraps (a line of 90+ characters followed by more of the
 * same paragraph) and let the box wrap each paragraph once. Short lines such as headings, and the
 * Apache-2.0 text, whose paragraphs are single lines, stay as they are. Display only: the build's
 * list keeps the text verbatim.
 */
export function joinHardWraps(text: string) {
  return text.replace(/^(.{90,})\n(?=\S)/gm, '$1 ');
}

function PackageRow({ item, licenseText }: { item: ListedPackage; licenseText: string }) {
  const body = item.standardText ? joinHardWraps(licenseText) : licenseText;
  const text = item.copyright.length ? `${item.copyright.join('\n')}\n\n${body}` : body;
  // The standard text keeps its template line; say that the lines above it fill the blank.
  const fillsBlank = item.copyright.length > 0 && licenseText.includes(COPYRIGHT_BLANK);
  return (
    <li className={styles.package}>
      <details>
        <summary>
          <IconChevronRight
            className={styles.chevron}
            size={16}
            stroke={2}
            aria-hidden="true"
          />
          <span className={styles.packageName}>{item.name}</span>
          {item.version ? (
            <span className={styles.packageVersion}>{item.version}</span>
          ) : null}
          {item.bundledIn ? (
            <span className={styles.packageBundled}>隨 {item.bundledIn} 附帶</span>
          ) : null}
          <span className={styles.packageLicense}>{item.license}</span>
        </summary>
        <div className={styles.packageBody}>
          {item.homepage ? (
            <p>
              <ExternalLink href={item.homepage}>{shortUrl(item.homepage)}</ExternalLink>
            </p>
          ) : null}
          {item.standardText ? (
            <p className={styles.note}>
              套件沒有附上授權全文，以下是 {item.standardText.split(', ').join('、')}{' '}
              的標準條文。
              {fillsBlank
                ? `條文中的 ${COPYRIGHT_BLANK}，指的是最上面列出的版權聲明。`
                : null}
            </p>
          ) : null}
          <pre className={styles.licenseText} tabIndex={0}>
            {text}
          </pre>
          {item.notice ? (
            <pre className={styles.licenseText} tabIndex={0}>
              {item.notice}
            </pre>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function ThirdPartyPackages({ list }: { list: ThirdPartyList | null }) {
  if (!list) {
    return (
      <p className={styles.muted}>
        這份清單在正式建置網站時自動產生，目前的開發環境還沒有清單。
      </p>
    );
  }
  return (
    <>
      <p>
        {`網頁下載到你瀏覽器執行的程式，包含下面 ${list.packages.length} 個開源套件。`}
        這份清單在每次網站更新時，依實際打包進網頁的套件自動產生；點開套件名稱可以看授權條文。
      </p>
      <p className={styles.updated}>清單更新：{list.updated}</p>
      <ul className={styles.counts} aria-label="各授權的套件數">
        {countByLicense(list.packages).map(({ license, count }) => (
          <li key={license}>
            {license} <span className={styles.count}>{count}</span>
          </li>
        ))}
      </ul>
      <ul className={styles.packages} aria-label="第三方套件">
        {list.packages.map((item) => (
          <PackageRow
            key={`${item.name}@${item.version ?? ''}/${item.bundledIn ?? ''}`}
            item={item}
            licenseText={list.licenseTexts[item.licenseText]}
          />
        ))}
      </ul>
    </>
  );
}

export function LicensesPage({ thirdParty }: { thirdParty: ThirdPartyList | null }) {
  return (
    <div className={styles.page}>
      <article className={styles.panel}>
        <header className={styles.section}>
          <p>
            建築師大集結是開源網站。這裡說明網站程式碼的授權方式，以及網站用到的字型、考古題資料和第三方套件各自的授權。
          </p>
        </header>

        <section className={styles.section}>
          <h2>網站程式碼</h2>
          <p>
            建築師大集結的程式碼採用 GNU Affero 通用公共授權條款第 3 版（AGPL
            v3）或之後的版本。
          </p>
          <p>
            你可以自由使用、修改和散布這些程式碼。修改後的版本只要散布出去，或放上網路讓別人使用，就必須用同樣的授權公開完整的原始碼。
          </p>
          <p>速記圖庫的整理圖由網站作者製作，也採用這個授權。</p>
          <p className={styles.links}>
            <ExternalLink href={SOURCE_CODE_URL}>原始碼</ExternalLink>
            <ExternalLink href={AGPL_URL}>授權條款全文</ExternalLink>
          </p>
        </section>

        <section className={styles.section}>
          <h2>字型</h2>
          <p>
            按「製作紙本檔案」產生練習卷 PDF 時，如果網站無法使用你電腦裡的新細明體或
            Times New
            Roman（例如電腦沒有這兩套字型、瀏覽器不支援讀取本機字型，或你沒有允許讀取），就會改用下面兩套開源字型。它們採用
            SIL 開放字型授權 1.1（OFL 1.1），不適用上面的 AGPL。
          </p>
          <ul className={styles.fonts}>
            <li>
              <span className={styles.fontName}>Shane Daily Paper Ming</span>
              <span>由 Adobe 的 Noto Serif CJK TC 擷取練習卷用到的字並轉檔而成。</span>
              <a href="/fonts/daily-paper/OFL.txt">
                授權全文<span className={styles.srOnly}>（Shane Daily Paper Ming）</span>
              </a>
            </li>
            <li>
              <span className={styles.fontName}>Tinos</span>
              <span>Steve Matteson 設計的開源字型，只保留練習卷用到的字。</span>
              <a href="/fonts/daily-paper/OFL-Tinos.txt">
                授權全文<span className={styles.srOnly}>（Tinos）</span>
              </a>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>考古題與法規</h2>
          <p>
            考古題的題目和標準答案取自考選部公布的資料，法規條文取自全國法規資料庫。依著作權法第
            9
            條，依法令舉行的考試試題，以及法律和命令，都不是著作權保護的對象，因此不適用上面的授權。
          </p>
        </section>

        <section className={styles.section}>
          <h2>網站圖示</h2>
          <p>
            側欄的大樓圖案、瀏覽器分頁和主畫面的網站圖示，來自 Tabler Icons 的
            building-skyscraper 圖示，採用 MIT 授權，條文見下方的 @tabler/icons-react。
          </p>
        </section>

        <section className={styles.section}>
          <h2>第三方套件</h2>
          <ThirdPartyPackages list={thirdParty} />
        </section>
      </article>
    </div>
  );
}
