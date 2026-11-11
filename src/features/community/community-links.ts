/**
 * Keep each QR code and every link to the same place on one canonical URL:
 * the QR image in public/social encodes exactly `href`, so changing a link
 * means regenerating its QR code too.
 */
export const threadsProfile = {
  name: 'Threads',
  handle: '@archi.exam_sup',
  href: 'https://www.threads.com/@archi.exam_sup',
  qrCode: '/social/threads-archi-exam-sup.svg',
} as const;

/** The LINE OpenChat invite link, without the share sheet's utm_* tracking query. */
export const lineCommunity = {
  name: 'LINE 開源社群',
  handle: '建築師大集結開源討論群',
  href: 'https://line.me/ti/g2/OH11gDAPosXdZPLd4w4wCkQNHE6L-tZXjU7W0A',
  qrCode: '/social/line-open-chat.svg',
} as const;
