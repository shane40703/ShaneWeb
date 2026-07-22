import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { NotesPage } from '@/features/notes/notes-page';
import { loadAllQuestions } from '@/server/question-bank.server';
import type { Question } from '@/lib/types';

export const getStaticProps: GetStaticProps<{ questions: Question[] }> = async () => ({
  props: { questions: await loadAllQuestions() },
});

export default function NotesRoute({ questions }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <><Head><title>使用者筆記｜建築師考試</title></Head><NotesPage questions={questions} /></>;
}
