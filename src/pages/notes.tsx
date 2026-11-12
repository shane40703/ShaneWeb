import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { SimilarRowsSeed } from '@/components/similar-questions';
import { NotesPage } from '@/features/notes/notes-page';
import { PersonalLayout } from '@/features/personal/personal-layout';
import { useQuestionEntries } from '@/lib/use-question-entries';
import {
  getQuestionPageProps,
  type QuestionPageProps,
} from '@/server/question-bank.server';

/** The same prerendered pair as 歷屆試題討論版: the paper index and one question. */
export const getStaticProps: GetStaticProps<QuestionPageProps> = async () => ({
  props: await getQuestionPageProps(),
});

export default function NotesRoute({
  paperIndex,
  initialQuestion,
  initialSimilar,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const bank = useQuestionEntries(paperIndex, initialQuestion ?? undefined);

  return (
    <>
      <Head>
        <title>我的筆記｜建築師考試</title>
      </Head>
      <PersonalLayout>
        <SimilarRowsSeed rows={initialSimilar}>
          <NotesPage
            questions={bank.entries}
            questionBankStatus={bank.status}
            onRetryQuestionBank={bank.retry}
          />
        </SimilarRowsSeed>
      </PersonalLayout>
    </>
  );
}
