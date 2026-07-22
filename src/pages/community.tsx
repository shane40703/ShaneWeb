import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { CommunityPage } from '@/features/community/community-page';
import { loadAllQuestions } from '@/server/question-bank.server';
import type { Question } from '@/lib/types';

export const getStaticProps: GetStaticProps<{ questions: Question[] }> = async () => ({
  props: { questions: await loadAllQuestions() },
});

export default function CommunityRoute({ questions }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <><Head><title>詳解與討論｜建築師考試</title></Head><CommunityPage questions={questions} /></>;
}
