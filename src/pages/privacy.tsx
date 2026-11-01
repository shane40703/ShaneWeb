import Head from 'next/head';
import { PrivacyPage } from '@/features/privacy/privacy-page';

export default function PrivacyRoute() {
  return (
    <>
      <Head>
        <title>隱私權政策｜建築師考試</title>
      </Head>
      <PrivacyPage />
    </>
  );
}
