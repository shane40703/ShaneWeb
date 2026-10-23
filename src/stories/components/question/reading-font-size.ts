import { useEffect } from 'react';
import { useAppState } from '@/state/app-state';

/** 外觀設定可選的字級（px），預設 18。 */
const readingFontSizes = [14, 16, 18, 20, 22, 24];

/** Controls 的「字級」選單：跟外觀設定的滑桿一樣，題目與選項一起調整。 */
export const readingFontSizeArgType = {
  name: '字級',
  description: '外觀設定的題目與選項字級（px）',
  control: 'select' as const,
  options: readingFontSizes,
  // 放在元件 props 後面的「外觀設定」分組。
  table: { category: '外觀設定' },
};

/**
 * 把 Controls 選的字級存進本機的外觀設定，跟網站的外觀設定走同一條路：
 * 畫面從 CSS 變數 `--question-font-size`／`--option-font-size` 讀到字級。
 */
export function useReadingFontSize(size: number) {
  const { dispatch } = useAppState();
  useEffect(() => {
    dispatch({
      type: 'set-reading-preferences',
      questionFontSize: size,
      optionFontSize: size,
    });
  }, [dispatch, size]);
}
