import { defineCloudflareConfig } from '@opennextjs/cloudflare';

const cloudflareConfig = {
  ...defineCloudflareConfig(),
  buildCommand: 'next build',
};

export default cloudflareConfig;
