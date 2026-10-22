import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { buildLawDatabaseEntries } from '@/features/laws/law-database';
import {
  LawDatabasePage,
  type LawDatabaseEntry,
} from '@/features/laws/law-database-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import { getQuestionSummaries } from '@/server/question-bank.server';

export const getStaticProps: GetStaticProps<{ laws: LawDatabaseEntry[] }> = async () => ({
  props: { laws: buildLawDatabaseEntries(await getQuestionSummaries()) },
});

export default function ResourceLawsRoute({
  laws,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>法規資料庫｜建築師考試</title>
      </Head>
      <ResourceLayout current="laws" facts={`收錄考題曾出現的 ${laws.length} 項法規；`}>
        <LawDatabasePage laws={laws} showHeader={false} />
      </ResourceLayout>
    </>
  );
}
