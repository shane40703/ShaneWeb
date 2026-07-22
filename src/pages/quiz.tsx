import Head from 'next/head';
import { QuizPage } from '@/features/quiz/quiz-page';

export default function QuizRoute() {
  return <><Head><title>作答頁｜建築師考試</title></Head><QuizPage /></>;
}
