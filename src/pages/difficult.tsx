import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { DifficultPage } from '@/features/difficult/difficult-page';
import { loadAllQuestions } from '@/server/question-bank.server';
import type { Question } from '@/lib/types';

export const getStaticProps: GetStaticProps<{ questions: Question[] }> = async () => ({
  props: { questions: await loadAllQuestions() },
});

export default function DifficultRoute({ questions }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <><Head><title>難題標記｜建築師考試</title></Head><DifficultPage questions={questions} /></>;
}
