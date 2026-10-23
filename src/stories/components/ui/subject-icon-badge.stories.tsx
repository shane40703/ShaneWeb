import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SubjectIconBadge } from '@/components/subject-icon';
import { subjects } from '@/question-bank/catalog';

/**
 * 科目圖示：四個科目各自的顏色與圖示並排，上排小尺寸（題目選擇器的科目按鈕）、下排大尺寸
 * （首頁的科目卡片）。圖示本身（SubjectIcon）網站上只畫在這個底色方塊裡：大尺寸 38px／
 * 線寬 1.7，小尺寸 18px／線寬 2。
 *
 * 工具列切到手機寬度（560px 以下）時，大尺寸會縮小。
 */
const meta = {
  title: 'Components/基礎 UI/SubjectIconBadge',
  component: SubjectIconBadge,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof SubjectIconBadge>;

export default meta;

export const 全部科目: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gap: 20 }}>
      {(['compact', 'large'] as const).map((size) => (
        <div key={size} style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {subjects.map((subject) => (
            <div
              key={subject.id}
              style={{ display: 'grid', justifyItems: 'center', gap: 8, fontSize: 13 }}
            >
              <SubjectIconBadge subject={subject.id} size={size} />
              <span>{subject.shortName}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};
