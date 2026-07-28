import type { NextApiRequest, NextApiResponse } from 'next';
import { loadSubjectQuestions } from '@/server/question-bank.server';
import { isSubjectId } from '@/lib/study';
import type { Question } from '@/lib/types';
import { years } from '@/question-bank/catalog';

/**
 * Serves one subject's questions so pages can load the bank on demand instead of
 * inlining it into every prerendered page. The bank only changes on redeploy, so
 * the response is safe to cache hard.
 */
export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<Question[] | { error: string }>,
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
  response.setHeader(
    'Cache-Control',
    'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
  );
  response.status(200).json(await loadSubjectQuestions(subject, year));
}
