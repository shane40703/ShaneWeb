import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import { getQuestionSummaries } from '@/server/question-bank.server';
import type { QuestionSummary } from '@/lib/types';

export const getStaticProps: GetStaticProps<{
  questions: QuestionSummary[];
}> = async () => ({
  props: { questions: await getQuestionSummaries() },
});

export default function ResourceAnalysisRoute({
  questions,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>考題分析｜建築師考試</title>
      </Head>
      <ResourceLayout current="analysis">
        <AnalysisPage questions={questions} />
      </ResourceLayout>
    </>
  );
}
