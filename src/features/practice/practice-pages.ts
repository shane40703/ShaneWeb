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
  summary: '從歷屆考古題抽題，並隨機打亂選項',
} as const;

export const practiceClozePage = {
  id: 'law-cloze',
  href: '/practice/law-cloze',
  label: '法規克漏字',
  icon: IconForms,
  summary: '法規數字練習',
} as const;

export const practiceMockExamPage = {
  id: 'mock-exam',
  href: '/practice/mock-exam',
  label: '歷屆試題模擬考',
  icon: IconClipboardText,
  summary: '自選 100～114 年任一份考古題，模擬考試時的實際作答',
} as const;

export const practicePages = [
  practiceQuizPage,
  practiceMockExamPage,
  practiceClozePage,
] as const;

export type PracticeHubPageLink = (typeof practicePages)[number];
