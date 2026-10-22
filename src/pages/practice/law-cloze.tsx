import Head from 'next/head';
import { LawClozePage } from '@/features/law-cloze/law-cloze-page';
import { PracticeLayout } from '@/features/practice/practice-layout';

// The new pages link to each other: related past questions open in 歷屆試題（新版）.
function examQuestionHref(item: { id: string }) {
  return `/exams?question=${item.id}`;
}

export default function PracticeLawClozeRoute() {
  return (
    <>
      <Head>
        <title>法規克漏字｜建築師考試</title>
      </Head>
      <PracticeLayout narrow>
        <LawClozePage examQuestionHref={examQuestionHref} />
      </PracticeLayout>
    </>
  );
}
