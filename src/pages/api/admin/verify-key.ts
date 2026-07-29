import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<{ ok: true } | { error: string }>,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'method not allowed' });
    return;
  }
  const configuredKey = process.env.AUTHOR_EDIT_KEY?.trim();
  if (!configuredKey) {
    response.status(503).json({ error: '伺服器尚未設定作者編輯金鑰' });
    return;
  }
  const suppliedKey =
    typeof request.body?.key === 'string' ? request.body.key : '';
  if (suppliedKey !== configuredKey) {
    response.status(401).json({ error: '作者編輯金鑰錯誤' });
    return;
  }
  response.status(200).json({ ok: true });
}
