import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CopyQuestionButton } from '@/components/copy-question-button';
import { imageQuestion } from '../../fixtures/questions';

/** 複製題幹與目前顯示的選項順序，略過附圖；需要瀏覽器剪貼簿權限。 */
const meta = {
  title: 'Components/題目/CopyQuestionButton',
  component: CopyQuestionButton,
  args: { question: imageQuestion },
} satisfies Meta<typeof CopyQuestionButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const 複製題目: Story = {};
