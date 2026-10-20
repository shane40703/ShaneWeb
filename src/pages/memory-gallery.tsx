import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { MemoryGalleryPage } from '@/features/memory-gallery/memory-gallery-page';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import { memoryGalleryStore } from '@/server/memory-gallery.server';

export const getStaticProps: GetStaticProps<{ items: MemoryGalleryImage[] }> = async () => ({
  props: { items: await memoryGalleryStore.list() },
});

export default function MemoryGalleryRoute({ items }: { items: MemoryGalleryImage[] }) {
  return <><Head><title>速記圖庫｜建築師考試</title></Head><MemoryGalleryPage items={items} /></>;
}
