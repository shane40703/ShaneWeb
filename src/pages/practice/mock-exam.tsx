import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { buildMockExamPapers, type MockExamPaper } from '@/features/practice/mock-exam';
import { MockExamPage } from '@/features/practice/mock-exam-page';
import { PracticeLayout } from '@/features/practice/practice-layout';
import { getPaperQuestionSummaries } from '@/server/question-bank.server';

// Only the list of papers ships with the page; a paper's questions load when it is opened.
export const getStaticProps: GetStaticProps<{ papers: MockExamPaper[] }> = async () => ({
  props: { papers: buildMockExamPapers(await getPaperQuestionSummaries()) },
});

export default function PracticeMockExamRoute({
  papers,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>歷屆試題模擬考｜建築師考試</title>
      </Head>
      <PracticeLayout>
        <MockExamPage papers={papers} />
      </PracticeLayout>
    </>
  );
}
