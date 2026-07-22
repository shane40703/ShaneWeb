import type { SubjectId } from '@/question-bank/schema';

export function questionPath(
  subject: SubjectId,
  year: number,
  questionNumber: number,
) {
  return `/questions/${subject}/${year}/${String(questionNumber).padStart(2, '0')}`;
}

export function questionPathFromId(questionId: string) {
  const match = /^(law|env|construction|structure)-(\d{3})-(\d{2})$/.exec(questionId);
  if (!match) return null;
  return questionPath(match[1] as SubjectId, Number(match[2]), Number(match[3]));
}
