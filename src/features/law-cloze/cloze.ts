import data from './bank.json';

export interface ClozeBlank {
  answer: string;
  label: string;
  unit: string;
  original: string;
}
export interface ClozeQuestion {
  id: string;
  lawId: string;
  category: string;
  title: string;
  articleNumber: string;
  articleLabel: string;
  sourceUrl: string;
  template: string;
  blanks: ClozeBlank[];
  answerRanges: Array<{ start: number; end: number; blankIndex: number }>;
  fullText: string;
  images: Array<{ url: string; alt: string }>;
  fullFileUrl: string | null;
  evidence: Array<{ id: string; year: number; number: number }>;
  evidenceKind?: 'topic' | 'extension';
}
export const clozeBank: Omit<typeof data, 'questions'> & { questions: ClozeQuestion[] } = { ...data, questions: data.questions as ClozeQuestion[] };
export const CLOZE_STORAGE_KEY = 'shaneweb:law-cloze';
export const CLOZE_COUNTS = [5, 10, 15, 20, 25, 30] as const;
export function getClozeCategories(lawId = '全部') {
  return [...new Set(data.questions.filter((q) => lawId === '全部' || q.lawId === lawId).map((q) => q.category))];
}

export function getFullArticleParts(question: ClozeQuestion) {
  const parts: Array<{ text: string; isAnswer: boolean; blankIndex?: number }> = [];
  let cursor = 0;
  for (const range of question.answerRanges) {
    parts.push({ text: question.fullText.slice(cursor, range.start), isAnswer: false });
    parts.push({ text: question.fullText.slice(range.start, range.end), isAnswer: true, blankIndex: range.blankIndex });
    cursor = range.end;
  }
  parts.push({ text: question.fullText.slice(cursor), isAnswer: false });
  return parts;
}

const digits: Record<string, number> = {
  '零': 0, '〇': 0, '○': 0, '一': 1, '二': 2, '兩': 2, '三': 3,
  '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
};
function numericValue(raw: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  const scaled = raw.match(/^(\d+)([十百千萬億])$/);
  if (scaled) return Number(scaled[1]) * ({ '十': 10, '百': 100, '千': 1000, '萬': 10000, '億': 100000000 }[scaled[2]] ?? 0);
  if (raw.includes('點') || raw.includes('.')) {
    const parts = raw.split(/[點.]/);
    if (parts.length !== 2 || !parts[1]) return null;
    const integer = numericValue(parts[0]);
    const decimals = [...parts[1]].map((char) => /\d/.test(char) ? char : digits[char]);
    return integer !== null && decimals.every((char) => char !== undefined)
      ? integer + Number('0.' + decimals.join('')) : null;
  }
  if (!/^[零〇○一二兩三四五六七八九十百千萬億]+$/.test(raw)) return null;
  if (![...raw].some((char) => '十百千萬億'.includes(char))) {
    return Number([...raw].map((char) => digits[char]).join(''));
  }
  let total = 0;
  let section = 0;
  let number = 0;
  for (const char of raw) {
    if (char in digits) number = digits[char];
    else if (char === '億') {
      total = (total + section + number) * 100000000;
      section = 0;
      number = 0;
    } else if (char === '萬') {
      total += (section + number) * 10000;
      section = 0;
      number = 0;
    } else {
      section += (number || 1) * ({ '十': 10, '百': 100, '千': 1000 }[char] ?? 0);
      number = 0;
    }
  }
  return total + section + number;
}

export function normalizeStatutoryAnswer(value: string, unit = ''): string | null {
  let normalized = value.normalize('NFKC').replace(/[\s,、]/g, '').replace(/[‧．]/g, '.');
  if (unit === '%') normalized = normalized.replace(/^百分之/, '').replace(/%$/, '');
  const suffix = unit.normalize('NFKC');
  if (suffix && unit !== '比例' && unit !== '比值' && normalized.endsWith(suffix)) {
    normalized = normalized.slice(0, -suffix.length);
  }
  if (normalized === '半') return 'half';
  const fraction = normalized.match(/^(.+)分之(.+)$/);
  const ratio = normalized.match(/^([^/:比]+)[/:比]([^/:比]+)$/);
  if (fraction || ratio) {
    const numerator = numericValue(fraction ? fraction[2] : ratio![1]);
    const denominator = numericValue(fraction ? fraction[1] : ratio![2]);
    if (numerator === null || denominator === null || denominator <= 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    const kind = fraction || normalized.includes('/') ? 'fraction' : 'ratio';
    return kind + ':' + numerator + '/' + denominator;
  }
  if (!/^[\d零〇○一二兩三四五六七八九十百千萬億點.]+$/.test(normalized)) return null;
  const number = numericValue(normalized);
  return number !== null && Number.isFinite(number)
    ? (/[點.]/.test(normalized) ? 'decimal:' : 'integer:') + number : null;
}

export function gradeCloze(question: ClozeQuestion, answers: readonly string[]) {
  return question.blanks.map((blank, index) => {
    const actual = normalizeStatutoryAnswer(answers[index] ?? '', blank.unit);
    const expected = normalizeStatutoryAnswer(blank.original, blank.unit);
    return actual !== null && actual === expected;
  });
}

export interface ClozeOptions {
  lawId: string;
  category: string;
  count: number;
}
export interface ClozeSession extends ClozeOptions {
  version: string;
  order: string[];
  index: number;
  answers: string[];
  submitted: boolean;
  results: Record<string, string[]>;
  revealed: string[];
}

export function getClozePool(options: Pick<ClozeOptions, 'lawId' | 'category'>) {
  return clozeBank.questions.filter((q) => (options.lawId === '全部' || q.lawId === options.lawId) && (options.category === '全部' || q.category === options.category));
}
function validOptions(options: ClozeOptions) {
  return ['全部', ...data.laws.map((law) => law.id)].includes(options.lawId)
    && ['全部', ...getClozeCategories(options.lawId)].includes(options.category)
    && CLOZE_COUNTS.some((count) => count === options.count);
}
export function createClozeSession(options: Partial<ClozeOptions> = {}, random = Math.random): ClozeSession {
  const settings = { lawId: '全部', category: '全部', count: 10, ...options };
  if (!validOptions(settings)) throw new Error('Invalid cloze options');
  const pool = getClozePool(settings);
  const order = pool.map((q) => q.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { version: data.version, ...settings, order: order.slice(0, settings.count), index: 0, answers: [], submitted: false, results: {}, revealed: [] };
}

export function revealClozeAnswer(session: ClozeSession): ClozeSession {
  const id = session.order[session.index];
  if (session.submitted || session.revealed.includes(id)) return session;
  // Preserve drafts, but never fabricate correct answers or graded results.
  return { ...session, revealed: [...session.revealed, id] };
}

export function parseClozeSession(raw: string | null): ClozeSession | null {
  try {
    const value = JSON.parse(raw ?? 'null') as ClozeSession | null;
    if (!value || !validOptions(value)) return null;
    const compatible = data.compatibleVersions.find((entry) => entry.version === value.version);
    if (value.version !== data.version && !compatible) return null;
    // A previously capped round must not grow or lose its saved answers when the bank expands.
    const pool = getClozePool(value).filter((q) => value.version === data.version || compatible!.questionIds.includes(q.id));
    const expectedLength = Math.min(value.count, pool.length);
    if (!Array.isArray(value.order) || value.order.length !== expectedLength || new Set(value.order).size !== expectedLength || !value.order.every((id) => pool.some((q) => q.id === id))) return null;
    if (!Number.isInteger(value.index) || value.index < 0 || value.index >= value.order.length || typeof value.submitted !== 'boolean') return null;
    const validAnswers = (answers: unknown): answers is string[] => Array.isArray(answers) && answers.every((a) => typeof a === 'string' && a.length <= 50);
    if (!validAnswers(value.answers) || !value.results || typeof value.results !== 'object' || Array.isArray(value.results)) return null;
    const revealed: unknown = value.revealed === undefined ? [] : value.revealed;
    if (!Array.isArray(revealed) || revealed.some((id) => typeof id !== 'string') || new Set(revealed).size !== revealed.length) return null;
    const currentId = value.order[value.index];
    const resolved = value.submitted || revealed.includes(currentId);
    const visited = value.order.slice(0, value.index + Number(resolved));
    if (revealed.some((id) => !visited.includes(id) || Object.hasOwn(value.results, id))) return null;
    const results: Record<string, string[]> = {};
    for (const [id, answers] of Object.entries(value.results)) {
      const question = pool.find((q) => q.id === id);
      if (!question || !visited.includes(id) || !validAnswers(answers) || answers.length !== question.blanks.length || answers.some((a) => !a.trim())) return null;
      results[id] = answers;
    }
    const question = pool.find((q) => q.id === value.order[value.index])!;
    if (Object.keys(results).length + revealed.length !== visited.length || (value.answers.length !== 0 && value.answers.length !== question.blanks.length)) return null;
    if (value.submitted && (!results[question.id] || value.answers.length !== question.blanks.length || value.answers.some((a, i) => a !== results[question.id][i]))) return null;
    return { version: value.version, lawId: value.lawId, category: value.category, count: value.count, order: value.order, index: value.index, answers: value.answers, submitted: value.submitted, results, revealed };
  } catch {
    return null;
  }
}
