import Head from 'next/head';
import { SettingsPanel } from '@/features/settings/settings-panel';

export default function SettingsPage() {
  return (
    <>
      <Head><title>設定｜建築師考試</title></Head>
      <SettingsPanel />
    </>
  );
}
