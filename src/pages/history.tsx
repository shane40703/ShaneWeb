import Head from 'next/head';
import { HistoryPage } from '@/features/history/history-page';

export default function HistoryRoute() {
  return <><Head><title>已作答紀錄｜建築師考試</title></Head><HistoryPage /></>;
}
