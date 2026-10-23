import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import { ResourcesPage } from '@/features/resources/resources-page';
import {
  buildResourcesOverview,
  type ResourcesOverview,
} from '@/features/resources/resources-overview';
import { memoryGalleryStore } from '@/server/memory-gallery.server';
import { getQuestionSummaries } from '@/server/question-bank.server';

export const getStaticProps: GetStaticProps<{
  overview: ResourcesOverview;
}> = async () => ({
  props: {
    overview: buildResourcesOverview(
      await getQuestionSummaries(),
      await memoryGalleryStore.list(),
    ),
  },
});

export default function ResourcesRoute({
  overview,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>統計分析｜建築師考試</title>
      </Head>
      <ResourcesPage overview={overview} />
    </>
  );
}
