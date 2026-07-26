import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { NotesPage } from '@/features/notes/notes-page';
import { loadSubjectQuestions } from '@/server/question-bank.server';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import { subjects } from '@/question-bank/catalog';
import type { Question } from '@/lib/types';

const allSubjectIds = subjects.map((subject) => subject.id);

/**
 * Only the first subject is prerendered; the rest arrive from /api/questions so
 * the page payload no longer grows with the whole bank. Saved notes can point
 * at any subject, so every subject is requested here.
 */
export const getStaticProps: GetStaticProps<{
  initialQuestions: Question[];
}> = async () => ({
  props: { initialQuestions: await loadSubjectQuestions(allSubjectIds[0]) },
});

export default function NotesRoute({
  initialQuestions,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const bank = useSubjectQuestions(allSubjectIds);
  const questions = bank.status === 'ready' ? bank.questions : initialQuestions;

  return (
    <>
      <Head>
        <title>使用者筆記｜建築師考試</title>
      </Head>
      <NotesPage
        questions={questions}
        questionBankStatus={bank.status}
        onRetryQuestionBank={bank.retry}
      />
    </>
  );
}
