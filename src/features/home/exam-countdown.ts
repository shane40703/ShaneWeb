import { useSyncExternalStore } from 'react';

const dayMs = 86_400_000;
const OFFICIAL_EXAM_LIST = 'https://wwwc.moex.gov.tw/main/exam/wFrmExamInformation.aspx?menu_id=145';

interface ExamSchedule {
  name: string;
  startsOn: string;
  endsOn: string;
  source: string;
  estimated: boolean;
}

// Dates in this table are maintained explicitly; unlisted years use a clearly labelled estimate.
const knownExams: Record<number, Omit<ExamSchedule, 'name'>> = {
  2026: {
    startsOn: '2026-11-14',
    endsOn: '2026-11-16',
    source: 'https://wwwc.moex.gov.tw/main/exam/wFrmExamDetail.aspx?c=115180',
    estimated: false,
  },
  2027: {
    startsOn: '2027-11-20',
    endsOn: '2027-11-22',
    source: 'https://wwwc.moex.gov.tw/main/exam/wFrmExamDetail.aspx?c=116180',
    estimated: false,
  },
};

/** Estimate the Saturday closest to 14 November, followed by Sunday and Monday. */
export function getExamSchedule(year: number): ExamSchedule {
  const known = knownExams[year];
  if (known) return { name: `${year - 1911} 年建築師考試`, ...known };
  const midNovember = Date.UTC(year, 10, 14);
  const daysToSaturday = (6 - new Date(midNovember).getUTCDay() + 7) % 7;
  const nearestSaturday = midNovember + (daysToSaturday > 3 ? daysToSaturday - 7 : daysToSaturday) * dayMs;
  return {
    name: `${year - 1911} 年建築師考試`,
    startsOn: new Date(nearestSaturday).toISOString().slice(0, 10),
    endsOn: new Date(nearestSaturday + 2 * dayMs).toISOString().slice(0, 10),
    source: OFFICIAL_EXAM_LIST,
    estimated: true,
  };
}
const taipeiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function getTaipeiDate(now = new Date()) {
  return taipeiDate.format(now);
}

export function getExamCountdown(today: string) {
  const date = Date.parse(`${today}T00:00:00Z`);
  let exam = getExamSchedule(Number(today.slice(0, 4)));
  if (today > exam.endsOn) exam = getExamSchedule(Number(today.slice(0, 4)) + 1);
  const start = Date.parse(`${exam.startsOn}T00:00:00Z`);
  if (date < start) return { exam, phase: 'before' as const, days: Math.round((start - date) / dayMs) };
  return { exam, phase: 'ongoing' as const, days: Math.round((date - start) / dayMs) + 1 };
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
