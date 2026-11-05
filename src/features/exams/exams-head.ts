import { examsHubName, parseQuestionId, type ExamsPlace } from '@/lib/question-path';
import { formatQuestionNumberLabel } from '@/lib/study';
import type { Question } from '@/lib/types';
import { getSubject } from '@/question-bank/catalog';
import {
  paperFacts,
  topLabels,
  type PaperFacts,
  type PaperIndex,
  type PaperTopics,
} from '@/question-bank/derived-data';

const SITE_NAME = '建築師考試';
const USE = '可以逐題作答、看解答和討論。';
const EVERY_QUESTION = '每一題都可以作答、看解答和討論。';
const STEM_LENGTH = 110;
/** Before a measure word: 兩科, not 二科. */
const NUMERALS = ['零', '一', '兩', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 3,672: the one way a count is written, so the build and the browser print the same text. */
export function formatCount(value: number) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 四 for the four subjects; larger numbers stay digits. */
export function countWord(value: number) {
  return NUMERALS[value] ?? formatCount(value);
}

/** 「甲」「甲與乙」「甲、乙與丙」 */
export function joinWithAnd(items: readonly string[]) {
  return items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join('、')}與${items.at(-1)}`;
}

/** 「申論題 3 題」「選擇題 40 題」: written first, as on the paper; a kind it lacks is left out. */
export function questionCounts(facts: Pick<PaperFacts, 'written' | 'multipleChoice'>) {
  return [
    facts.written ? `申論題 ${formatCount(facts.written)} 題` : '',
    facts.multipleChoice ? `選擇題 ${formatCount(facts.multipleChoice)} 題` : '',
  ].filter(Boolean);
}

/** 「民國 100 至 114 年」 */
export function yearRange(facts: Pick<PaperFacts, 'firstYear' | 'lastYear'>) {
  return facts.firstYear === facts.lastYear
    ? `民國 ${facts.firstYear} 年`
    : `民國 ${facts.firstYear} 至 ${facts.lastYear} 年`;
}

/** What the page has to say about its place; only a question's page has a question. */
export interface ExamsHeadData {
  /** The prerendered question. */
  question?: Question | null;
  paperIndex?: PaperIndex;
  /** The paper's topic words, once they are here. */
  paperTopics?: PaperTopics | null;
}

/** What a search result shows for an address under /exams. */
export function examsHead(
  place: ExamsPlace,
  data: ExamsHeadData = {},
): { title: string; description?: string } {
  const title = `${examsHubName(place)}｜${SITE_NAME}`;
  if (place.kind === 'question') return questionHead(place, data.question);
  const subject = place.kind === 'bank' ? undefined : getSubject(place.subject);
  const facts = paperFacts(
    data.paperIndex ?? {},
    subject?.id,
    place.kind === 'paper' ? place.year : undefined,
  );
  if (!facts.papers) return { title };

  if (place.kind === 'bank') {
    const names = facts.subjects.map((id) => getSubject(id)?.name).join('、');
    const total = formatCount(facts.written + facts.multipleChoice);
    return {
      title,
      description: `建築師考試歷屆考古題：${names}${countWord(facts.subjects.length)}科，${yearRange(facts)}共 ${formatCount(facts.papers)} 份試卷、${total} 題，${EVERY_QUESTION}`,
    };
  }
  if (place.kind === 'subject') {
    return {
      title,
      description: `建築師考試${subject?.name}歷屆考古題，${yearRange(facts)}共 ${formatCount(facts.papers)} 份試卷、${questionCounts(facts).join('與')}，${EVERY_QUESTION}`,
    };
  }
  const topics =
    data.paperTopics?.subject === place.subject && data.paperTopics.year === place.year
      ? topLabels(data.paperTopics.rows, 3).map(([label]) => label)
      : [];
  const most = topics.length ? `考得最多的是${joinWithAnd(topics)}，` : '';
  return {
    title,
    description: `${place.year} 年建築師考試${subject?.name}考古題，${questionCounts(facts).join('、')}，${most}${EVERY_QUESTION}`,
  };
}

function questionHead(
  place: Extract<ExamsPlace, { kind: 'question' }>,
  question?: Question | null,
) {
  const paper = examsHubName(place);
  const subject = getSubject(place.subject);
  const overview = `${place.year} 年建築師考試${subject?.name}考古題，${USE}`;
  const parsed = parseQuestionId(place.questionId);
  if (!parsed) return { title: `${paper}｜${SITE_NAME}`, description: overview };

  const label = formatQuestionNumberLabel(parsed);
  const stem =
    question && question.id === place.questionId
      ? question.text.replace(/\s+/g, ' ').trim()
      : '';
  const excerpt = stem.length > STEM_LENGTH ? `${stem.slice(0, STEM_LENGTH)}…` : stem;
  return {
    title: `${paper}${label}｜${SITE_NAME}`,
    description: excerpt
      ? `${place.year} 年建築師考試${subject?.name}${label}：${excerpt}`
      : overview,
  };
}
