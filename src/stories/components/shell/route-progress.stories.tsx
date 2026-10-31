import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RouteProgress, RouteSheet } from '@/components/layout/route-progress';
import styles from '@/components/layout/app-shell.module.css';

/** 按下連結後新頁面還沒到：頂部一條線，稍等後主內容換成虛線佔位框。 */
const meta = {
  title: 'Components/網站外框/RouteProgress',
  component: RouteProgress,
  args: { active: true },
  render: ({ active }) => (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <RouteProgress active={active} />
      </header>
      <main className={styles.main} data-leaving={active || undefined}>
        {active ? <RouteSheet /> : null}
        <p>正在離開的頁面</p>
      </main>
    </div>
  ),
} satisfies Meta<typeof RouteProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 換頁中: Story = {};

export const 已到達: Story = { args: { active: false } };
