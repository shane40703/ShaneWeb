import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { CategoryAdminPage } from '@/features/admin/category-admin-page';
import type { QuestionSummary } from '@/lib/types';
import { getQuestionSummaries } from '@/server/question-bank.server';

export const getStaticProps: GetStaticProps<{
  questions: QuestionSummary[];
}> = async () => ({
  props: { questions: await getQuestionSummaries() },
});

export default function CategoryAdminRoute({
  questions,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>題目分類管理｜建築師考試</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <CategoryAdminPage questions={questions} />
    </>
  );
}
