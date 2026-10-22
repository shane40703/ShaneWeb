import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { clozeBank } from '@/features/law-cloze/cloze';
import { PracticeHubPage } from '@/features/practice/practice-hub-page';
import {
  buildPracticeOverview,
  type PracticeOverview,
} from '@/features/practice/practice-overview';
import { getMultipleChoiceQuestions } from '@/server/question-bank.server';

export const getStaticProps: GetStaticProps<{
  overview: PracticeOverview;
}> = async () => ({
  props: {
    overview: buildPracticeOverview(await getMultipleChoiceQuestions(), clozeBank),
  },
});

export default function PracticeRoute({
  overview,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>每日練習（新版）｜建築師考試</title>
      </Head>
      <PracticeHubPage overview={overview} />
    </>
  );
}
