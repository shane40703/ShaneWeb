import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import { useSubjectStems } from '@/lib/question-bank-client';
import { isSubjectId } from '@/lib/study';
import { subjects, years } from '@/question-bank/catalog';
import { facetQuestions, facetSummaries } from '@/question-bank/derived-data';
import {
  getAnalysisPageProps,
  type AnalysisPageProps,
} from '@/server/question-bank.server';

const initialSubject = subjects[0].id;
const initialYear = years[0];

/**
 * Every chart is computed from the facets of all four subjects, which ship with the page; the
 * rows of the view it opens on ship too, so crawlers read them. Any other view fetches its
 * subject's stems, and the charts around the rows never wait.
 */
export const getStaticProps: GetStaticProps<AnalysisPageProps> = async () => ({
  props: await getAnalysisPageProps(initialSubject, initialYear),
});

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResourceAnalysisRoute({
  facets,
  initialStems,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter();
  const querySubject = valueOf(router.query.subject);
  const subject = isSubjectId(querySubject) ? querySubject : initialSubject;
  const year = valueOf(router.query.year) ?? String(initialYear);
  const shipped = Boolean(initialStems[subject]?.[year]);
  const { stems, status } = useSubjectStems(shipped ? null : subject);
  const questions = useMemo(
    () =>
      subjects.flatMap(({ id }) => {
        const own = facets[id];
        if (!own) return [];
        const text = id === subject && stems ? stems : initialStems[id];
        return facetSummaries(id, own, text);
      }),
    [facets, initialStems, stems, subject],
  );
  const practiceQuestions = useMemo(
    () => facets[subject] ? facetQuestions(subject, facets[subject]!) : [],
    [facets, subject],
  );

  return (
    <>
      <Head>
        <title>考題分析｜建築師考試</title>
      </Head>
      <ResourceLayout current="analysis">
        <AnalysisPage questions={questions} practiceQuestions={practiceQuestions} rowsLoading={!shipped && !stems && status === 'loading'} />
      </ResourceLayout>
    </>
  );
}
