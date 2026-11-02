import { examsQuestionId, examsSlugParts, parseQuestionId } from '@/lib/question-path';
import { formatQuestionNumberLabel } from '@/lib/study';
import type { Question } from '@/lib/types';
import { getSubject, years } from '@/question-bank/catalog';

const SITE_NAME = '建築師考試';
const USE = '可以逐題作答、看解答和討論。';
const STEM_LENGTH = 110;

/** What a search result shows for an address under /exams; `question` is the prerendered one. */
export function examsHead(
  slug: string | string[] | undefined,
  question?: Question | null,
) {
  const [subjectId, year] = examsSlugParts(slug);
  const subject = subjectId ? getSubject(subjectId) : undefined;
  if (!subject) return { title: `考古題討論版｜${SITE_NAME}` };

  const paper = year ? `${year} 年${subject.name}考古題` : `${subject.name}考古題`;
  const overview = year
    ? `${year} 年建築師考試${subject.name}考古題，${USE}`
    : `建築師考試${subject.name}歷屆考古題，民國 ${years.at(-1)} 至 ${years[0]} 年，${USE}`;
  const id = examsQuestionId(slug, []);
  const parsed = id ? parseQuestionId(id) : null;
  if (!parsed) return { title: `${paper}｜${SITE_NAME}`, description: overview };

  const label = formatQuestionNumberLabel(parsed);
  const stem = question && question.id === id ? question.text.replace(/\s+/g, ' ').trim() : '';
  const excerpt = stem.length > STEM_LENGTH ? `${stem.slice(0, STEM_LENGTH)}…` : stem;
  return {
    title: `${paper}${label}｜${SITE_NAME}`,
    description: excerpt
      ? `${year} 年建築師考試${subject.name}${label}：${excerpt}`
      : overview,
  };
}
