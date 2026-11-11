import Head from 'next/head';
import { CommunityPage } from '@/features/community/community-page';

export default function LineRoute() {
  return (
    <>
      <Head>
        <title>LINE 社群｜建築師考試</title>
        <meta
          name="description"
          content="加入建築師大集結的 LINE 社群：許願新功能、回報錯誤、一起協作網站，也交流建築師考試內容。"
        />
      </Head>
      <CommunityPage channel="line" />
    </>
  );
}
