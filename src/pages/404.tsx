import Head from 'next/head';
import Link from 'next/link';
import { EmptyState } from '@/components/content/content';
import { Button } from '@/components/ui/ui';

/** Any address the site does not have, such as a mistyped or outdated link. */
export default function NotFoundRoute() {
  return (
    <>
      <Head>
        <title>找不到頁面｜建築師考試</title>
      </Head>
      <EmptyState
        title="找不到這個頁面"
        description="網址可能打錯了，或這個頁面已經移除。"
        action={
          <Button role="link" variant="primary" render={<Link href="/" />}>
            回到首頁
          </Button>
        }
      />
    </>
  );
}
