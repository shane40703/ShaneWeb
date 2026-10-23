import type { Preview } from '@storybook/nextjs-vite';
import { sb } from 'storybook/test';
import { cloudModes } from '../src/stories/support/cloud-sync';
import { installFetchMock } from '../src/stories/support/mock-fetch';
import {
  prepareStoryEnvironment,
  type StoryEnvironmentParameters,
  withStoryProviders,
} from '../src/stories/support/story-environment';
import '../src/styles/globals.css';

// 「雲端同步」工具列用：保留原本的程式，故事需要時才換掉登入狀態（support/cloud-sync.ts）。
sb.mock('../src/components/cloud-sync-provider.tsx', { spy: true });
sb.mock('../src/lib/firebase-client.ts', { spy: true });

installFetchMock();
document.documentElement.lang = 'zh-Hant';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: '網站的淺色／深色主題',
      toolbar: {
        title: '主題',
        icon: 'mirror',
        items: [
          { value: 'light', title: '淺色' },
          { value: 'dark', title: '深色' },
        ],
        dynamicTitle: true,
      },
    },
    shell: {
      description: 'Layouts 是否顯示網站的側欄與頂部列',
      toolbar: {
        title: '外框',
        icon: 'sidebar',
        items: [
          { value: 'show', title: '顯示側欄外框' },
          { value: 'hide', title: '隱藏側欄外框' },
        ],
        dynamicTitle: true,
      },
    },
    cloud: {
      description: '頂部列與問題回報的登入狀態（不會真的連到 Firebase）',
      toolbar: {
        title: '雲端同步',
        icon: 'cloud',
        items: Object.entries(cloudModes).map(([value, title]) => ({ value, title })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    shell: 'show',
    cloud: 'local',
  },
  parameters: {
    layout: 'padded',
    nextjs: {
      router: { pathname: '/', asPath: '/', query: {} },
    },
    viewport: {
      options: {
        mobile: {
          name: '手機 390×844',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        tablet: {
          name: '平板 820×1180',
          styles: { width: '820px', height: '1180px' },
          type: 'tablet',
        },
        laptop: {
          name: '筆電 1280×800',
          styles: { width: '1280px', height: '800px' },
          type: 'desktop',
        },
        desktop: {
          name: '桌機 1440×900',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
    backgrounds: { disable: true },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
      // 在故事裡點擊、切換 Controls 只是看畫面，不跳出「存回故事檔」的提示。
      disableSaveFromUI: true,
    },
    options: {
      storySort: {
        order: ['Components', 'Layouts'],
      },
    },
  },
  beforeEach: async ({ parameters }) => {
    await prepareStoryEnvironment(parameters as StoryEnvironmentParameters);
  },
  decorators: [withStoryProviders],
};

export default preview;
