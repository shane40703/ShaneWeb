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
  async redirects() {
    return [
      { source: '/report', destination: '/community', permanent: true },
      {
        // The link in Threads posts. Temporary, so that its campaign can change later.
        source: '/threads',
        destination: '/?utm_source=threads&utm_medium=social&utm_campaign=launch',
        permanent: false,
      },
      {
        // Links shared before each question had its own address.
        source: '/exams',
        has: [
          {
            type: 'query',
            key: 'question',
            value: '(?<subject>[a-z]+)-(?<year>\\d{3})-written-0*(?<number>\\d+)',
          },
        ],
        destination: '/exams/:subject/:year/written-:number',
        permanent: true,
      },
      {
        source: '/exams',
        has: [
          {
            type: 'query',
            key: 'question',
            value: '(?<subject>[a-z]+)-(?<year>\\d{3})-0*(?<number>\\d+)',
          },
        ],
        destination: '/exams/:subject/:year/:number',
        permanent: true,
      },
    ];
  },
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
