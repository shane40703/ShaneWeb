import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import type { ParsedUrlQuery } from 'node:querystring';
import Head from 'next/head';
import { QuizPage, type StaticQuestionPageProps } from '@/features/quiz/quiz-page';
import {
  findQuestionEntry,
  getQuestionStaticPaths,
  loadQuestion,
  loadQuizQuestions,
} from '@/server/question-bank.server';

interface QuestionParams extends ParsedUrlQuery {
  subject: string;
  year: string;
  number: string;
}

export const getStaticPaths: GetStaticPaths<QuestionParams> = async () => ({
  paths: await getQuestionStaticPaths(),
  fallback: false,
});

export const getStaticProps: GetStaticProps<
  StaticQuestionPageProps,
  QuestionParams
> = async ({ params }) => {
  const subject = String(params?.subject ?? '');
  const year = String(params?.year ?? '');
  const number = String(params?.number ?? '');
  const entry = await findQuestionEntry(subject, year, number);
  if (!entry) return { notFound: true };

  const question = await loadQuestion(entry);
  const paperQuestions = await loadQuizQuestions(entry.subject, entry.year);
  const position = paperQuestions.findIndex((candidate) => candidate.id === question.id);

  return { props: { question, paperQuestions, position } };
};

export default function StaticQuestionRoute({
  question,
  paperQuestions,
  position,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>{`${question.year} 年第 ${question.questionNumber} 題｜建築師考試`}</title>
      </Head>
      <QuizPage
        question={question}
        paperQuestions={paperQuestions}
        position={position}
      />
    </>
  );
}
