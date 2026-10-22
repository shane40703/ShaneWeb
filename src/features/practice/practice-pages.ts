import { IconCalendarCheck, IconForms, IconListCheck } from '@tabler/icons-react';

/**
 * Single source for the new daily practice hub and its two pages, shared by the sidebar,
 * hub cards, practice URLs and topbar titles so their wording never drifts.
 */
export const practiceHub = {
  href: '/practice',
  label: '每日練習（新版）',
  icon: IconCalendarCheck,
} as const;

export const practiceQuizPage = {
  id: 'quiz',
  href: '/practice/quiz',
  label: '選擇題練習',
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

export const practicePages = [practiceQuizPage, practiceClozePage] as const;

export type PracticeHubPageLink = (typeof practicePages)[number];
