import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LicensesPage } from '@/features/licenses/licenses-page';
import { licensesList } from '../../fixtures/licenses';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 開源授權（/licenses），從設定的「開源授權」進來。跟隱私權政策一樣是一張面板裡用虛線分段的
 * 純文字頁面：網站程式碼、字型、考古題與法規、網站圖示，最後是第三方套件清單。正式頁面的清單
 * 由 getStaticProps 讀正式建置產生的 .next/third-party-licenses.json，這裡用
 * `fixtures/licenses.ts` 的幾個實際套件。
 *
 * 畫面上可以操作看到：點套件名稱展開授權條文，條文太長時在框內捲動；@firebase/app 與
 * @pdf-lib/fontkit 沒有附上授權全文，展開後說明下面是標準條文。原始碼、授權條款全文與套件網站
 * 另開新分頁。
 */
const meta = {
  title: 'Layouts/開源授權/授權說明',
  component: LicensesPage,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/licenses') },
  args: { thirdParty: licensesList },
} satisfies Meta<typeof LicensesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 授權說明: Story = {};

/** `next dev` 找不到正式建置的清單時，第三方套件一段只說明清單在哪裡產生。 */
export const 開發環境沒有清單: Story = { args: { thirdParty: null } };
