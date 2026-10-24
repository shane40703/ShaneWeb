import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  LawDatabasePage,
  type LawDatabaseEntry,
} from '@/features/laws/law-database-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import { lawDatabaseEntries } from '../../fixtures/resources';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/** 跟 src/pages/resources/laws.tsx 一樣：歷屆試題資料集成的頁首加上法規數量，下面是法規清單。 */
function LawDatabaseRoute({ laws }: { laws: LawDatabaseEntry[] }) {
  return (
    <ResourceLayout current="laws" facts={`收錄考題曾出現的 ${laws.length} 項法規；`}>
      <LawDatabasePage laws={laws} showHeader={false} />
    </ResourceLayout>
  );
}

/**
 * 法規資料庫（/resources/laws）：範例題庫（法規 101、113、114 年）標註過的法規，
 * 依出現題數排序。
 *
 * 畫面上可以操作看到：點法規會在新分頁開啟全國法規資料庫的搜尋結果。
 */
const meta = {
  title: 'Layouts/法規資料庫/法規清單',
  component: LawDatabaseRoute,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/resources/laws') },
  args: { laws: lawDatabaseEntries },
} satisfies Meta<typeof LawDatabaseRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 範例題庫: Story = {};

/** 題庫還沒有標註法規：頁首寫 0 項法規，清單是空的。 */
export const 尚無法規: Story = {
  args: { laws: [] },
};
