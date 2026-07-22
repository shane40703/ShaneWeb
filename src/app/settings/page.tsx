import type { Metadata } from 'next';
import { SettingsPage } from '@/features/settings/settings-page';

export const metadata: Metadata = { title: '網頁介面設定' };

export default function Page() {
  return <SettingsPage />;
}
