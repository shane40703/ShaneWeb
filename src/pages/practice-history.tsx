import HistoryRoute from './history';

/** Only explicit daily-draw saves; the existing all-attempt history remains intact. */
export default function DailyPracticeHistoryRoute() {
  return <HistoryRoute dailyOnly />;
}
