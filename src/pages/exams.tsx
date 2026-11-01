import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { SimilarRowsSeed } from '@/components/similar-questions';
import { ExamsPage } from '@/features/exams/exams-page';
import { useQuestionEntries } from '@/lib/use-question-entries';
import {
  getQuestionPageProps,
  type QuestionPageProps,
} from '@/server/question-bank.server';

/**
 * The paper index and one question: what a click and a crawler need at once. Everything else
 * downloads after the page shows, one paper at a time, so the route change never waits for it.
 */
export const getStaticProps: GetStaticProps<QuestionPageProps> = async () => ({
  props: await getQuestionPageProps(),
});

export default function ExamsRoute({
  paperIndex,
  initialQuestion,
  initialSimilar,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const bank = useQuestionEntries(paperIndex, initialQuestion ?? undefined);

  return (
    <>
      <Head>
        <title>考古題討論版｜建築師考試</title>
      </Head>
      <SimilarRowsSeed rows={initialSimilar}>
        <ExamsPage
          questions={bank.entries}
          questionBankStatus={bank.status}
          onRetryQuestionBank={bank.retry}
        />
      </SimilarRowsSeed>
    </>
  );
}
