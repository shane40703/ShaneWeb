import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { LawDatabasePage, type LawDatabaseEntry } from '@/features/laws/law-database-page';
import { getQuestionSummaries } from '@/server/question-bank.server';

export const getStaticProps: GetStaticProps<{ laws: LawDatabaseEntry[] }> = async () => {
  const counts = new Map<string, number>();
  (await getQuestionSummaries())
    .filter((question) => question.subject === 'law')
    .flatMap((question) => question.relatedLaws ?? [])
    .forEach((law) => counts.set(law, (counts.get(law) ?? 0) + 1));

  return {
    props: {
      laws: [...counts]
        .map(([name, questionCount]) => ({
          name,
          questionCount,
          linkable: name !== '???' && name !== '廢止',
        }))
        .sort(
          (left, right) =>
            right.questionCount - left.questionCount ||
            left.name.localeCompare(right.name, 'zh-Hant'),
        ),
    },
  };
};

export default function LawsRoute({ laws }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <><Head><title>法規資料庫｜建築師考試</title></Head><LawDatabasePage laws={laws} /></>;
}
