import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SimilarRowsSeed } from '@/components/similar-questions';
import { examsHead } from '@/features/exams/exams-head';
import { ExamsPage } from '@/features/exams/exams-page';
import { useQuestionEntries } from '@/lib/use-question-entries';
import {
  getExamsSlugs,
  getQuestionPageProps,
  type QuestionPageProps,
} from '@/server/question-bank.server';

type ExamsParams = { slug?: string[] };

/** Every subject, paper and question has its own page, so that search engines can list them. */
export const getStaticPaths: GetStaticPaths<ExamsParams> = async () => ({
  paths: [[], ...(await getExamsSlugs())].map((slug) => ({ params: { slug } })),
  fallback: false,
});

/**
 * The paper index and one question: what a click and a crawler need at once. Everything else
 * downloads after the page shows, one paper at a time, so the route change never waits for it.
 */
export const getStaticProps: GetStaticProps<QuestionPageProps, ExamsParams> = async ({
  params,
}) => ({
  props: await getQuestionPageProps(params?.slug),
});

export default function ExamsRoute({
  paperIndex,
  initialQuestion,
  initialSimilar,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter();
  const bank = useQuestionEntries(paperIndex, initialQuestion ?? undefined);
  const head = examsHead(router.query.slug, initialQuestion);

  return (
    <>
      <Head>
        <title>{head.title}</title>
        {head.description ? <meta name="description" content={head.description} /> : null}
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
