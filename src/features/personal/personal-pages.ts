import { IconNotebook } from '@tabler/icons-react';

/**
 * Single source for the 我的作答存摺 hub and the pages it gathers, shared by the sidebar,
 * hub rows and topbar titles so their wording never drifts.
 */
export const personalHub = {
  href: '/personal',
  label: '我的作答存摺',
  icon: IconNotebook,
} as const;

export const personalPages = [
  {
    id: 'notes',
    href: '/notes',
    label: '我的筆記',
    summary: '為每一題寫下的筆記',
  },
  {
    id: 'difficult',
    href: '/difficult',
    label: '難題標記',
    summary: '標記為難題的題目，可以整科重練',
  },
  {
    id: 'wrong',
    href: '/wrong',
    label: '常錯題目',
    summary: '答錯過的題目與累計次數，可以整科重練',
  },
  {
    id: 'practice-history',
    href: '/practice-history',
    label: '每日練習履歷',
    summary: '選擇儲存的每日抽題練習紀錄',
  },
  {
    id: 'history',
    href: '/history',
    label: '歷屆試題作答履歷',
    summary: '歷屆試題模擬考的作答紀錄',
  },
] as const;

export type PersonalPage = (typeof personalPages)[number];
