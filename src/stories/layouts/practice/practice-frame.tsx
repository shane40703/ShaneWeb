import type { Decorator } from '@storybook/nextjs-vite';
import { PracticeLayout } from '@/features/practice/practice-layout';
import pageStyles from '@/features/practice/practice-page.module.css';
import {
  PRACTICE_SESSION_STORAGE_KEY,
  type PracticeSession,
} from '@/features/practice/practice-session';
import { pageParameters } from '../../support/story-environment';

/**
 * 每日抽題練習的故事大多畫整個 /practice/quiz 頁面（PracticeQuizRoute），只有頁面操作不到的
 * 載入狀態才畫其中一段（設定、作答、結果）。只畫一段時用這個外層，跟網站一樣：外面是
 * 「返回每日練習」的 PracticeLayout，裡面是 PracticePage 的根元素（practice-page.module.css
 * 的 `.root`）。作答與結果畫面加上 `.fullWidth`，設定維持原本寬度。根元素是版面的
 * container，作答、設定、結果畫面都依它的寬度切換手機版排法，少了它手機版會跑版。
 *
 * 放在故事自己的 decorators（排在 meta 的 withStatefulRouter、withPageFrame 裡面）。
 */
function practiceSectionFrame(fullWidth: boolean): Decorator {
  return function PracticeSectionFrame(Story) {
    return (
      <PracticeLayout>
        <div className={fullWidth ? `${pageStyles.root} ${pageStyles.fullWidth}` : pageStyles.root}>
          <Story />
        </div>
      </PracticeLayout>
    );
  };
}

export const withPracticeSectionFrame = practiceSectionFrame(false);
export const withPracticeQuestionFrame = practiceSectionFrame(true);
export const withPracticeResultFrame = practiceSectionFrame(true);

/**
 * 整頁故事的 parameters：瀏覽器裡存的練習進度，加上網址參數。沒給網址參數時跟網站一樣
 * 停在題組目前的題目（`?q=` 從 1 開始）。
 */
export function practicePageParameters(
  session: PracticeSession,
  query: Record<string, string> = { q: String(session.currentIndex + 1) },
) {
  return {
    ...pageParameters('/practice/quiz', query),
    localStorage: { [PRACTICE_SESSION_STORAGE_KEY]: session },
  };
}

/**
 * 整頁故事的 beforeEach。網站離開題組（重新選科、重新抽題）時，用瀏覽器的上一頁退回題組
 * 開始的那一頁；故事裡換題不會真的加進瀏覽紀錄，退回會跑到 Storybook 上一個看過的故事。
 * 這裡改成原地通知「已退回」，網站就照常把網址換成目前的畫面。
 */
export function stayInStoryOnRewind() {
  window.history.go = () => {
    window.setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')));
  };
  return () => {
    Reflect.deleteProperty(window.history, 'go');
  };
}
