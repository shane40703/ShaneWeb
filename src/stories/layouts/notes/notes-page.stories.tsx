import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { NotesPage } from '@/features/notes/notes-page';
import { notesAppState } from '../../fixtures/personal';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { withPersonalFrame } from '../personal/personal-frame';
import { notesInitialQuestions, NotesRoute } from './notes-route';

/**
 * 我的筆記（/notes）：左邊是題目與筆記編輯器，右邊是題號導覽與已儲存筆記。
 * 要看哪一題由網址的 `?question=題目編號` 決定，沒有指定就是題庫的第一題（法規最新的
 * 114 年第 1 題）。網站只下載看到的那一卷；這裡一次向範例題庫要所有科目。
 *
 * 畫面上可以操作看到：
 * - 上方切換科目與年度，右側點題號或已儲存筆記換題。
 * - 「編輯筆記」打開即時編輯器與圖片上傳；字色、字級、上下標等效果會直接顯示，
 *   再按同一格式可取消，復原／重做與清單也能操作。「刪除筆記」跳出確認視窗。
 * - 還沒寫筆記的題目直接是空白的筆記編輯器。已儲存筆記只列出目前科目與年度的筆記，
 *   切到還沒寫筆記的年度（例如 114 年）就是全新使用者看到的「尚未儲存任何筆記」。
 */
const meta = {
  title: 'Layouts/我的筆記/筆記畫面',
  component: NotesRoute,
  decorators: [withStatefulRouter, withPageFrame],
  parameters: { ...pageParameters('/notes') },
  // 預先載入的題目固定是範例題庫的法規，不在 Controls 顯示。
  argTypes: { initialQuestions: { table: { disable: true } } },
} satisfies Meta<typeof NotesRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 一開始是法規 113 年第 27 題：格式化文字（粗體、斜體、紅字、上標）加兩張圖片。
 * 同一年的第 3、5、33 題也有筆記，第 17 題只有圖片（已儲存筆記顯示「圖片筆記 1 張」）。
 * 101 年第 15 題是很長的筆記、第 8 題題幹含圖片；環控 113 年第 23 題與申論題「申1」也有筆記。
 */
export const 已儲存筆記: Story = {
  parameters: {
    ...pageParameters('/notes', { question: 'law-113-27' }),
    appState: notesAppState,
  },
};

/** 網址指定的題目不在題庫（例如題目已移除）。 */
export const 找不到指定題目: Story = {
  parameters: { ...pageParameters('/notes', { question: 'law-113-99' }) },
};

/**
 * 網址指定環控的題目（環控 113 年第 23 題），環控題庫還沒下載好（用頁面的 props 固定狀態）：
 * Controls 的 bank 切換「正在載入題目」與「題庫載入失敗」，失敗時的「重新載入」記在 Actions。
 */
export const 題庫載入中或失敗: StoryObj<{
  bank: 'loading' | 'error';
  onRetryQuestionBank: () => void;
}> = {
  parameters: { ...pageParameters('/notes', { question: 'env-113-23' }) },
  decorators: [withPersonalFrame],
  render: ({ bank, onRetryQuestionBank }) => (
    <NotesPage
      questions={notesInitialQuestions}
      questionBankStatus={bank}
      onRetryQuestionBank={onRetryQuestionBank}
    />
  ),
  args: { bank: 'loading', onRetryQuestionBank: fn() },
  argTypes: {
    bank: {
      options: ['loading', 'error'],
      control: {
        type: 'select',
        labels: { loading: '載入中', error: '載入失敗' },
      },
    },
  },
};

/** 沒有題目可以寫筆記（用頁面的 props 固定題目）。 */
export const 題庫尚無資料: Story = {
  decorators: [withPersonalFrame],
  render: () => <NotesPage questions={[]} />,
};
