import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Head from 'next/head';
import {
  LicensesPage,
  thirdPartyList,
  type ThirdPartyList,
} from '@/features/licenses/licenses-page';
import {
  formatRocDate,
  readThirdPartyLicenses,
} from '@/server/third-party-licenses.server';

export const getStaticProps: GetStaticProps<{
  thirdParty: ThirdPartyList | null;
}> = async () => {
  const report = await readThirdPartyLicenses();
  return {
    props: {
      thirdParty: report
        ? thirdPartyList(formatRocDate(report.generatedAt), report.packages)
        : null,
    },
  };
};

export default function LicensesRoute({
  thirdParty,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>{`開源授權｜建築師考試`}</title>
        <meta
          name="description"
          content="建築師大集結的程式碼採用 AGPL v3 開源授權；這裡也列出網站用到的字型、考古題資料和第三方套件各自的授權。"
        />
      </Head>
      <LicensesPage thirdParty={thirdParty} />
    </>
  );
}
