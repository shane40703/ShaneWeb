import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import { MemoryGalleryAdminPage } from '@/features/memory-gallery/memory-gallery-admin-page';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import { canEditMemoryGallery, memoryGalleryStore } from '@/server/memory-gallery.server';

interface Props { initialItems: MemoryGalleryImage[]; editingAvailable: boolean }
export const getServerSideProps: GetServerSideProps<Props> = async ({ res }) => {
  res.setHeader('Cache-Control', 'no-store');
  return { props: { initialItems: await memoryGalleryStore.list(), editingAvailable: canEditMemoryGallery() } };
};
export default function MemoryGalleryAdminRoute(props: Props) {
  return <><Head><title>速記圖庫管理｜建築師考試</title><meta name="robots" content="noindex,nofollow" /></Head><MemoryGalleryAdminPage {...props} /></>;
}
