import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import {
  MemoryGalleryAdminLink,
  MemoryGalleryPage,
} from '@/features/memory-gallery/memory-gallery-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import { resourceGalleryHref } from '@/features/resources/resource-pages';
import {
  MEMORY_GALLERY_CATEGORIES,
  isMemoryGalleryCategory,
  memoryGalleryCategoryLabel,
  type MemoryGalleryCategory,
  type MemoryGalleryImage,
} from '@/lib/memory-gallery';
import { memoryGalleryStore } from '@/server/memory-gallery.server';

type Params = { category?: string[] };

const [defaultCategory, ...otherCategories] = MEMORY_GALLERY_CATEGORIES;

// One prerendered page per subject: /resources/memory-gallery shows the first subject,
// /resources/memory-gallery/<subject> the others (see resourceGalleryHref).
export const getStaticPaths: GetStaticPaths<Params> = async () => ({
  paths: [
    { params: { category: [] } },
    ...otherCategories.map((category) => ({ params: { category: [category.id] } })),
  ],
  fallback: false,
});

export const getStaticProps: GetStaticProps<
  { items: MemoryGalleryImage[]; category: MemoryGalleryCategory },
  Params
> = async ({ params }) => {
  const [slug] = params?.category ?? [];
  return {
    props: {
      items: await memoryGalleryStore.list(),
      category: isMemoryGalleryCategory(slug) ? slug : defaultCategory.id,
    },
  };
};

export default function ResourceMemoryGalleryRoute({
  items,
  category,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>{`速記圖庫・${memoryGalleryCategoryLabel(category)}｜建築師考試`}</title>
      </Head>
      <ResourceLayout current="memory-gallery" actions={<MemoryGalleryAdminLink />}>
        <MemoryGalleryPage
          items={items}
          showHeader={false}
          category={category}
          categoryHref={resourceGalleryHref}
        />
      </ResourceLayout>
    </>
  );
}
