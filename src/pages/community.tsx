import Head from 'next/head';
import { CommunityPage } from '@/features/community/community-page';

export default function CommunityRoute() {
  return <>
    <Head>
      <title>社群連結｜建築師考試</title>
      <meta name="description" content="追蹤 noki 的 Threads，或加入 LINE 社群交流建築師考試，一起討論網站想要的功能與錯誤回報。" />
    </Head>
    <CommunityPage />
  </>;
}
