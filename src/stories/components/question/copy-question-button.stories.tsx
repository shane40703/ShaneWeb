import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CopyQuestionButton } from '@/components/copy-question-button';
import { imageQuestion } from '../../fixtures/questions';

/**
 * 複製題幹與目前顯示的選項順序，略過附圖。按鈕本身就是回饋：按下後圖示變勾號、文字變
 * 「已複製」，2 秒後自己變回「複製題目」；再按一次會重新計時。三種狀態的按鈕寬度相同，
 * 旁邊的按鈕不會移動。
 */
const meta = {
  title: 'Components/題目/CopyQuestionButton',
  component: CopyQuestionButton,
  args: { question: imageQuestion },
} satisfies Meta<typeof CopyQuestionButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 瀏覽器擋下剪貼簿：剪貼簿與備用的複製指令都失敗。 */
function failClipboard() {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () =>
        Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => false,
  });
  return () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(document, 'execCommand');
  };
}

export const 複製題目: Story = {};

/** 按下後按鈕變成紅色「複製失敗」4 秒，右下角的通知說明要允許剪貼簿再試一次。 */
export const 複製失敗: Story = {
  beforeEach: failClipboard,
};
