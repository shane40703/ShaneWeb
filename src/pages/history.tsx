import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { HistoryPage } from '@/features/history/history-page';
import { loadAllQuestions } from '@/server/question-bank.server';
import type { Question } from '@/lib/types';

export const getStaticProps: GetStaticProps<{ questions: Question[] }> = async () => ({
  props: { questions: await loadAllQuestions() },
});

export default function HistoryRoute({ questions }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <><Head><title>已作答紀錄｜建築師考試</title></Head><HistoryPage questions={questions} /></>;
}
