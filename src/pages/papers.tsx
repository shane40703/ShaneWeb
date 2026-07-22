import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { PapersPage } from '@/features/papers/papers-page';
import { getQuestionSummaries } from '@/server/question-bank.server';
import type { QuestionSummary } from '@/lib/types';

export const getStaticProps: GetStaticProps<{ questions: QuestionSummary[] }> = async () => ({
  props: { questions: await getQuestionSummaries() },
});

export default function PapersRoute({ questions }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <><Head><title>歷屆試題｜建築師考試</title></Head><PapersPage questions={questions} /></>;
}
