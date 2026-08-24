import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { CommunityPage } from '@/features/community/community-page';
import { loadSubjectQuestions } from '@/server/question-bank.server';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { subjects } from '@/question-bank/catalog';
import type { Question } from '@/lib/types';

const allSubjectIds = subjects.map((subject) => subject.id);

/**
 * Only the first subject is prerendered — enough for the initial paint and for
 * crawlers — and the remaining subjects arrive from /api/questions so the page
 * payload no longer grows with the whole bank.
 */
export const getStaticProps: GetStaticProps<{
  initialQuestions: Question[];
}> = async () => ({
  props: { initialQuestions: await loadSubjectQuestions(allSubjectIds[0]) },
});

export default function CommunityRoute({
  initialQuestions,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const bank = useSubjectQuestions(allSubjectIds);
  const questions = [
    ...new Map(
      [...initialQuestions, ...bank.questions].map((question) => [
        question.id,
        question,
      ]),
    ).values(),
  ];

  return (
    <>
      <Head>
        <title>詳解與討論｜建築師考試</title>
      </Head>
      <CommunityPage
        questions={questions}
        questionBankStatus={bank.status}
        onRetryQuestionBank={bank.retry}
      />
    </>
  );
}
