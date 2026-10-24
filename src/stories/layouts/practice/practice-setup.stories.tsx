import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useMemo, useState } from 'react';
import { fn } from 'storybook/test';
import {
  createPracticePaper,
  createPracticeSession,
  DEFAULT_PRACTICE_SETTINGS,
  resolvePracticePool,
} from '@/features/practice/practice-session';
import { PracticeSetup } from '@/features/practice/practice-setup';
import type { Question, SubjectId } from '@/lib/types';
import PracticeQuizRoute from '@/pages/practice/quiz';
import { practiceBank } from '../../fixtures/practice';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { stayInStoryOnRewind, withPracticeSectionFrame } from './practice-frame';

/**
 * 題庫的載入狀態，跟 PracticePage 的 useSubjectQuestions 一樣：載入中還沒有題目；
 * 部分年度失敗時只剩載入成功的年度；全部失敗就沒有題目。
 */
type BankState = 'loading' | 'partial-error' | 'error';

function loadedQuestions(bank: BankState, subject: SubjectId): Question[] {
  if (bank !== 'partial-error') return [];
  const questions = practiceBank(subject);
  const latest = Math.max(...questions.map((question) => question.year));
  return questions.filter((question) => question.year === latest);
}

/**
 * 題庫還沒載入好時的設定畫面。整頁故事的題庫一定載入得到，所以這裡用 PracticePage 的算法
 * 自己準備 PracticeSetup：選科、調整進階選項一樣照網站的規則重算抽題範圍。
 */
function LoadingBankSetup({
  bank,
  paperFails,
  onStart,
  onRetry,
}: {
  bank: BankState;
  /** 製作紙本時題目還沒完整載入（網站實際的錯誤訊息）。 */
  paperFails: boolean;
  onStart: () => void;
  onRetry: () => void;
}) {
  const [subject, setSubject] = useState<SubjectId>('law');
  const [settings, setSettings] = useState(DEFAULT_PRACTICE_SETTINGS);
  const questions = useMemo(() => loadedQuestions(bank, subject), [bank, subject]);
  const pool = useMemo(
    () => resolvePracticePool(questions, subject, settings),
    [questions, subject, settings],
  );

  return (
    <PracticeSetup
      subject={subject}
      settings={settings}
      pool={pool}
      loading={bank === 'loading'}
      loadFailed={bank !== 'loading'}
      onRetry={onRetry}
      onSubjectChange={(next) => {
        setSubject(next);
        // 跟網站一樣：換科目時年度與類別回到預設，題數與選項設定保留。
        setSettings((current) => ({
          ...current,
          fromYear: undefined,
          toYear: undefined,
          category: 'all',
        }));
      }}
      onSettingsChange={setSettings}
      onStart={onStart}
      onMakePaper={() =>
        createPracticePaper(
          createPracticeSession(pool, subject, settings.shuffleOptions),
          paperFails ? new Map() : new Map(questions.map((item) => [item.id, item])),
        )
      }
    />
  );
}

/**
 * 打開時，網站向瀏覽器要本機字型的請求一直不回應（跟瀏覽器還在詢問權限一樣），
 * 「製作紙本檔案」就停在「正在製作 PDF…」，不會下載。
 */
function useHeldPaperFonts(hold: boolean) {
  useEffect(() => {
    if (!hold) return;
    const fontWindow = window as Window & { queryLocalFonts?: () => Promise<never> };
    fontWindow.queryLocalFonts = () => new Promise(() => undefined);
    return () => {
      // 拿掉自己加的設定，瀏覽器原本的功能（有的話）就回來了。
      Reflect.deleteProperty(fontWindow, 'queryLocalFonts');
    };
  }, [hold]);
}

/**
 * 每日抽題練習的設定畫面：整個 /practice/quiz 頁面，瀏覽器裡沒有進行中的題組時顯示。
 *
 * 畫面上可以操作看到：
 * - 選科目（環控等題庫不到 50 題的科目，題數多一個「全部」選項）
 * - 展開「進階選項」調整年度、類別、題數、打亂選項、一律給分題：摘要旁出現「已調整」，
 *   可以「恢復預設」
 * - 「線上作答」抽題後進入作答畫面，之後可以一路作答、完成練習、看練習結果
 * - 「製作紙本檔案」：按鈕變成「正在製作 PDF…」，再下載 PDF。要停在製作中，先打開
 *   Controls 的 holdPaper 再按
 */
const meta = {
  title: 'Layouts/每日抽題練習/設定畫面',
  component: PracticeQuizRoute,
  decorators: [withStatefulRouter, withPageFrame],
  parameters: { ...pageParameters('/practice/quiz') },
  beforeEach: stayInStoryOnRewind,
} satisfies Meta<typeof PracticeQuizRoute>;

export default meta;

export const 預設: StoryObj<{ holdPaper: boolean }> = {
  render: function Render({ holdPaper }) {
    useHeldPaperFonts(holdPaper);
    return <PracticeQuizRoute />;
  },
  args: { holdPaper: false },
  argTypes: {
    holdPaper: {
      description: '按「製作紙本檔案」後停在「正在製作 PDF…」（不會下載）',
    },
  },
};

/**
 * 題庫還沒載入好：Controls 的 bank 切換「載入中」「部分年度載入失敗」（已載入的年度仍可抽題）
 * 「全部載入失敗」（沒有可抽的題目，按鈕停用）。展開進階選項可以看到各組選項停用或沒有題數。
 * 部分年度載入失敗時打開 paperFails 再按「製作紙本檔案」，會顯示題目尚未完整載入的提示。
 */
export const 題庫載入中或失敗: StoryObj<typeof LoadingBankSetup> = {
  render: (args) => <LoadingBankSetup {...args} />,
  decorators: [withPracticeSectionFrame],
  args: { bank: 'loading', paperFails: false, onStart: fn(), onRetry: fn() },
  argTypes: {
    bank: {
      options: ['loading', 'partial-error', 'error'],
      control: {
        type: 'select',
        labels: {
          loading: '載入中',
          'partial-error': '部分年度載入失敗',
          error: '全部載入失敗',
        },
      },
    },
  },
};
