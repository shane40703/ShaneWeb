import { useSyncExternalStore } from 'react';

// 考選部 115 年建築師考試期日：民國 115/11/14–11/16。
export const ARCHITECT_EXAM = {
  name: '115 年建築師考試',
  startsOn: '2026-11-14',
  endsOn: '2026-11-16',
  source: 'https://wwwc.moex.gov.tw/main/exam/wFrmExamDetail.aspx?c=115180',
} as const;

const dayMs = 86_400_000;
const taipeiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function getTaipeiDate(now = new Date()) {
  return taipeiDate.format(now);
}

export function getExamCountdown(today: string) {
  const date = Date.parse(`${today}T00:00:00Z`);
  const start = Date.parse(`${ARCHITECT_EXAM.startsOn}T00:00:00Z`);
  const end = Date.parse(`${ARCHITECT_EXAM.endsOn}T00:00:00Z`);
  if (date < start) return { phase: 'before' as const, days: Math.round((start - date) / dayMs) };
  if (date <= end) return { phase: 'ongoing' as const, days: Math.round((date - start) / dayMs) + 1 };
  return { phase: 'finished' as const, days: 0 };
}

function subscribe(callback: () => void) {
  const interval = window.setInterval(callback, 60_000);
  window.addEventListener('focus', callback);
  document.addEventListener('visibilitychange', callback);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener('focus', callback);
    document.removeEventListener('visibilitychange', callback);
  };
}
const getSnapshot = () => getTaipeiDate();
const getServerSnapshot = () => null;

/** The static page never freezes the build day's countdown or mismatches hydration. */
export function useTaipeiDate() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
