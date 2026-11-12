import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PushMessageToast, PushTestBadge } from '@/components/push-message-toast';
import { Button } from '@/components/ui/ui';

/** 公告範例（非正式推播）。可按已讀、再次顯示；Controls 修改長文和 test/live，工具列切換深淺主題與手機寬度。 */
const meta = {
  title: 'Components/基礎 UI/PushMessageToast',
  component: PushMessageToast,
  args: {
    onRead: () => undefined,
    message: { id: 'storybook-example', status: 'test', message: '考前提醒：記得確認准考證與考場資訊。\n祝大家準備順利，也謝謝你一起讓題庫變得更完整！', expiresAt: 4_102_444_800_000 },
  },
  render: function Preview(args) {
    const [open, setOpen] = useState(true);
    const [long, setLong] = useState(false);
    return <>
      <Button onClick={() => { setLong(false); setOpen(true); }}>再次顯示範例公告</Button>
      <Button onClick={() => { setLong(true); setOpen(true); }}>顯示長文範例</Button>
      {args.message.status === 'test' ? <PushTestBadge /> : null}
      {open ? <PushMessageToast {...args} message={{ ...args.message, message: long
        ? '這是測試長文，不是正式公告。\n準備考試之餘，記得留一點時間休息；題庫更新與功能說明會透過這裡通知大家。\n'.repeat(15)
        : args.message.message }} onRead={() => setOpen(false)} /> : null}
    </>;
  },
} satisfies Meta<typeof PushMessageToast>;
export default meta;
type Story = StoryObj<typeof meta>;
export const 公告: Story = {};
