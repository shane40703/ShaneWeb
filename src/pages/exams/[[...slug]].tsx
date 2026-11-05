import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { SimilarRowsSeed } from '@/components/similar-questions';
import { examsHead } from '@/features/exams/exams-head';
import { ExamsLayout } from '@/features/exams/exams-layout';
import { ExamsPage } from '@/features/exams/exams-page';
import { examsPlace } from '@/lib/question-path';
import { useQuestionEntries } from '@/lib/use-question-entries';
import {
  paperTopicsFor,
  type PaperTopics,
  type QuestionEntry,
} from '@/question-bank/derived-data';
import {
  getExamsPageProps,
  getExamsSlugs,
  type ExamsPageProps,
} from '@/server/question-bank.server';

type ExamsParams = { slug?: string[] };

/** Every subject, paper and question has its own page, so that search engines can list them. */
export const getStaticPaths: GetStaticPaths<ExamsParams> = async () => ({
  paths: [[], ...(await getExamsSlugs())].map((slug) => ({ params: { slug } })),
  fallback: false,
});

/**
 * The paper index, and what the address names: a question's page gets that question, a
 * paper's page its topic words. Everything else downloads after the page shows, one paper at a
 * time, so the route change never waits for it.
 */
export const getStaticProps: GetStaticProps<ExamsPageProps, ExamsParams> = async ({
  params,
}) => ({
  props: await getExamsPageProps(params?.slug),
});

/** A paper page's topics: its own seed, or after a move to another paper, that paper's file. */
function usePaperTopics(
  slug: string | string[] | undefined,
  seed: PaperTopics | null,
  entries: readonly QuestionEntry[],
) {
  const place = examsPlace(slug);
  const subject = place.kind === 'paper' ? place.subject : undefined;
  const year = place.kind === 'paper' ? place.year : undefined;
  return useMemo(
    () =>
      subject && year !== undefined ? paperTopicsFor(subject, year, seed, entries) : null,
    [subject, year, seed, entries],
  );
}

export default function ExamsRoute({
  paperIndex,
  initialQuestion,
  initialSimilar,
  paperTopics,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter();
  const bank = useQuestionEntries(paperIndex, initialQuestion ?? undefined);
  const place = examsPlace(router.query.slug);
  const headTopics = usePaperTopics(router.query.slug, paperTopics, bank.entries);
  const head = examsHead(place, {
    question: initialQuestion,
    paperIndex,
    paperTopics: headTopics,
  });

  return (
    <>
      <Head>
        <title>{head.title}</title>
        {head.description ? <meta name="description" content={head.description} /> : null}
      </Head>
      {/* The same tree at every address, so the page is never remounted by a move. */}
      <ExamsLayout>
        <SimilarRowsSeed rows={initialSimilar}>
          <ExamsPage
            questions={bank.entries}
            questionBankStatus={bank.status}
            onRetryQuestionBank={bank.retry}
            paperTopics={paperTopics}
          />
        </SimilarRowsSeed>
      </ExamsLayout>
    </>
  );
}
