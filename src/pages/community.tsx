import Head from 'next/head';
import { CommunityPage } from '@/features/community/community-page';

export default function CommunityRoute() {
  return <>
    <Head>
      <title>社群連結｜建築師考試</title>
      <meta name="description" content="追蹤 noki 的 Threads 交流備考心得，或加入 LINE 開源社群，一起討論網站想要的功能與錯誤回報。" />
    </Head>
    <CommunityPage />
  </>;
}
