import type { StorybookConfig } from '@storybook/nextjs-vite';
import type { Plugin } from 'vite';

const firebaseEnvKeys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

/**
 * Stories never talk to Firebase, even when .env.local holds real keys: no sign-in,
 * no shared posts from production, and nothing a click in Storybook could publish.
 * `enforce: 'post'` lets this win over the Next plugin, which defines the same keys.
 */
const disableFirebase: Plugin = {
  name: 'storybook-disable-firebase',
  enforce: 'post',
  config: () => ({
    define: Object.fromEntries(
      firebaseEnvKeys.map((key) => [`process.env.${key}`, JSON.stringify('')]),
    ),
  }),
};

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.mdx', '../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  staticDirs: ['../public'],
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), disableFirebase],
  }),
};

export default config;
