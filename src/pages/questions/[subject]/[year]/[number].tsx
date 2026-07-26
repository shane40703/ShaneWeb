import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import type { ParsedUrlQuery } from 'node:querystring';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { QuizPage, type StaticQuestionPageProps } from '@/features/quiz/quiz-page';
import type { Question, QuizQuestion } from '@/lib/types';
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
  const questionBank = await loadQuizQuestions(entry.subject);

  return { props: { question, questionBank } };
};

function AllCreditQuestionRedirect({
  question,
  questionBank,
}: {
  question: Question;
  questionBank: QuizQuestion[];
}) {
  const router = useRouter();
  const eligibleQuestions = questionBank.filter(
    (candidate) => candidate.answerKey.kind !== 'all-credit',
  );
  const randomIds =
    router.query.mode === 'random' &&
    typeof router.query.questions === 'string'
      ? router.query.questions.split(',').filter(Boolean)
      : [];
  const eligibleRandomQuestions = randomIds.flatMap((id) => {
    const candidate = eligibleQuestions.find((item) => item.id === id);
    return candidate ? [candidate] : [];
  });
  const eligiblePaperQuestions = eligibleQuestions
    .filter((candidate) => candidate.year === question.year)
    .sort((left, right) => left.questionNumber - right.questionNumber);
  const nextPaperQuestion =
    eligiblePaperQuestions.find(
      (candidate) => candidate.questionNumber > question.questionNumber,
    ) ?? eligiblePaperQuestions[0];
  const randomQuestion = eligibleRandomQuestions[0];
  const destination = randomQuestion
    ? `${randomQuestion.path}?mode=random&questions=${encodeURIComponent(
        eligibleRandomQuestions.map((candidate) => candidate.id).join(','),
      )}`
    : nextPaperQuestion?.path ?? `/papers?subject=${question.subject}`;

  useEffect(() => {
    if (!router.isReady) return;
    void router.replace(destination);
  }, [destination, router]);

  return (
    <Head>
      <title>正在開啟下一題｜建築師考試</title>
    </Head>
  );
}

export default function StaticQuestionRoute({
  question,
  questionBank,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  if (question.answerKey.kind === 'all-credit') {
    return (
      <AllCreditQuestionRedirect
        question={question}
        questionBank={questionBank}
      />
    );
  }

  return (
    <>
      <Head>
        <title>{`${question.year} 年第 ${question.questionNumber} 題｜建築師考試`}</title>
      </Head>
      <QuizPage
        question={question}
        questionBank={questionBank}
      />
    </>
  );
}
