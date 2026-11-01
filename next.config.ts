import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

function questionDataVersion() {
  if (process.env.NODE_ENV !== 'production') return '';
  try {
    return readFileSync('public/question-data/version.txt', 'utf8').trim();
  } catch {
    return '';
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  env: { NEXT_PUBLIC_QUESTION_DATA_VERSION: questionDataVersion() },
  async headers() {
    return [
      {
        // Only a versioned URL may be kept: a tab from an older build asks without one.
        source: '/question-data/:path*',
        has: [{ type: 'query', key: 'v' }],
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
