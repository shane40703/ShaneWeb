import type { NextApiRequest, NextApiResponse } from 'next';
import { isSubjectId } from '@/lib/study';
import { years } from '@/question-bank/catalog';

/**
 * Keeps old bookmarked/API URLs working without bundling the entire question
 * bank into a serverless function. Current clients request the static file
 * directly from the deployment CDN.
 */
export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<{ error: string }>,
) {
  const raw = request.query.subject;
  const subject = Array.isArray(raw) ? raw[0] : raw;
  if (!isSubjectId(subject)) {
    response.status(404).json({ error: 'unknown subject' });
    return;
  }
  const rawYear = Array.isArray(request.query.year)
    ? request.query.year[0]
    : request.query.year;
  const year = rawYear === undefined ? undefined : Number(rawYear);
  if (year !== undefined && (!Number.isInteger(year) || !years.includes(year))) {
    response.status(400).json({ error: 'invalid year' });
    return;
  }
  if (year === undefined) {
    response.status(400).json({ error: 'year is required' });
    return;
  }
  response.redirect(307, `/question-data/${subject}/${year}.json`);
}
