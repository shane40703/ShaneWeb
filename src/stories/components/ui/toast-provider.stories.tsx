import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Toast } from '@base-ui/react/toast';
import { useEffect, useRef } from 'react';
import { Button, ToastProvider, useToast, type ToastTone } from '@/components/ui/ui';

interface ToastMessage {
  title: string;
  description?: string;
  tone?: ToastTone;
}

/** 網站實際會跳出的通知（notes-page、exams-page、history-page 的 notify）。 */
const siteToasts: ToastMessage[] = [
  { title: '筆記已儲存' },
  { title: '已加入我的筆記', description: '文字與圖片已保存到這一題。' },
  { title: '投稿完成', description: '內容已保存在目前瀏覽器。' },
  { title: '尚無可分享的筆記', tone: 'info' },
  {
    title: '無法貼上圖片',
    description: '僅接受 2 MB 以下圖片，每題最多 4 張。',
    tone: 'error',
  },
  { title: '瀏覽器無法儲存練習進度，暫時無法開始這組題目。', tone: 'error' },
];

/**
 * 放在 ToastProvider 裡、按下就跳出通知的按鈕。`keepOpen` 時用同一個通知管理器加上不會
 * 自動消失的通知，方便停在畫面上調整樣式，一開始先跳出有說明文字的「已加入我的筆記」；
 * 否則跟網站元件一樣呼叫 useToast 的 notify（2.6 秒後消失）。
 */
function ToastButtons({ keepOpen = false }: { keepOpen?: boolean }) {
  const { notify } = useToast();
  const manager = Toast.useToastManager();
  function show(toast: ToastMessage) {
    if (keepOpen) {
      manager.add({
        title: toast.title,
        description: toast.description,
        type: toast.tone,
        timeout: 0,
      });
    } else {
      notify(toast.title, toast.description, toast.tone);
    }
  }
  const shownInitialToast = useRef(false);
  useEffect(() => {
    if (!keepOpen || shownInitialToast.current) return;
    shownInitialToast.current = true;
    manager.add({
      title: siteToasts[1].title,
      description: siteToasts[1].description,
      timeout: 0,
    });
  }, [keepOpen, manager]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {siteToasts.map((toast) => (
        <Button key={toast.title} onClick={() => show(toast)}>
          {toast.title}
        </Button>
      ))}
    </div>
  );
}

/** Controls 的 children 選單：通知停在畫面上，或跟網站一樣自動消失。 */
const buttonModes = {
  通知停在畫面上: <ToastButtons keepOpen />,
  '2.6 秒後消失（跟網站一樣）': <ToastButtons />,
};

/**
 * 網站的通知：ToastProvider 包住整個網站（components/providers.tsx），裡面的元件用
 * useToast 的 notify 跳出通知，通知疊在畫面右下角。故事把跳出通知的按鈕放進
 * ToastProvider 裡（children），按鈕上的文字就是通知標題。
 *
 * 一開始跳出「已加入我的筆記」（標題加說明文字）。畫面上可以操作看到：
 * - 「筆記已儲存」只有標題；「已加入我的筆記」「投稿完成」有說明文字（綠色勾勾）；
 *   「尚無可分享的筆記」是提醒（藍色 i）；「無法貼上圖片」與最後一個會換行的長標題是操作
 *   失敗（紅色驚嘆號）。
 * - 連按幾個：通知疊在一起，後面的縮小、往上露出一點；滑鼠移上去展開成一列（最多三則）。
 * - 按通知右上角的叉叉關閉。
 *
 * 預設通知會停在畫面上，方便調整樣式；Controls 的 children 可以換成跟網站一樣 2.6 秒後
 * 自動消失（滑鼠停在通知上會暫停）。
 */
const meta = {
  title: 'Components/基礎 UI/ToastProvider',
  component: ToastProvider,
  args: { children: '通知停在畫面上' },
  argTypes: {
    children: {
      control: 'inline-radio',
      options: Object.keys(buttonModes),
      mapping: buttonModes,
    },
  },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 通知按鈕: Story = {};
