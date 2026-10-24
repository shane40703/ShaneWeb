import {
  IconCalendarCheck,
  IconClipboardText,
  IconForms,
  IconListCheck,
} from '@tabler/icons-react';

/**
 * Single source for the new daily practice hub and its pages, shared by the sidebar,
 * hub links, practice URLs and topbar titles so their wording never drifts.
 */
export const practiceHub = {
  href: '/practice',
  label: '每日練習',
  icon: IconCalendarCheck,
} as const;

export const practiceQuizPage = {
  id: 'quiz',
  href: '/practice/quiz',
  label: '每日抽題練習',
  icon: IconListCheck,
  summary: '從歷屆考古題抽題，逐題對答案',
} as const;

export const practiceClozePage = {
  id: 'law-cloze',
  href: '/practice/law-cloze',
  label: '法規克漏字',
  icon: IconForms,
  summary: '背熟法規裡的期限、罰鍰與尺寸',
} as const;

export const practiceMockExamPage = {
  id: 'mock-exam',
  href: '/practice/mock-exam',
  label: '歷屆試題模擬考',
  icon: IconClipboardText,
  summary: '選一份歷屆試卷，照原題號作答，交卷後按配分算分',
} as const;

export const practicePages = [
  practiceQuizPage,
  practiceMockExamPage,
  practiceClozePage,
] as const;

export type PracticeHubPageLink = (typeof practicePages)[number];
