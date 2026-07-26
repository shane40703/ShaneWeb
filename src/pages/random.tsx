import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { RandomPage } from '@/features/random/random-page';
import type { QuestionSummary } from '@/lib/types';
import { getQuestionSummaries } from '@/server/question-bank.server';

export const getStaticProps: GetStaticProps<{
  questions: QuestionSummary[];
}> = async () => ({
  props: { questions: await getQuestionSummaries() },
});

export default function RandomRoute({
  questions,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head><title>隨機出題｜建築師考試</title></Head>
      <RandomPage questions={questions} />
    </>
  );
}
