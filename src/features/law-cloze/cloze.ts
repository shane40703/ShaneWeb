import data from './bank.json';

export interface ClozeBlank {
  answer: string;
  label: string;
  unit: string;
  original: string;
}
export interface ClozeQuestion {
  id: string;
  category: string;
  title: string;
  articleNumber: string;
  template: string;
  blanks: ClozeBlank[];
  fullText: string;
  images: Array<{ url: string; alt: string }>;
  fullFileUrl: string | null;
  evidence: Array<{ id: string; year: number; number: number }>;
}
export const clozeBank: Omit<typeof data, 'questions'> & { questions: ClozeQuestion[] } = data;
export const CLOZE_STORAGE_KEY = 'shaneweb:law-cloze';
export const clozeCategories = [...new Set(data.questions.map((q) => q.category))];

const digits: Record<string, number> = {
  '零': 0, '〇': 0, '○': 0, '一': 1, '二': 2, '兩': 2, '三': 3,
  '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
};
function numericValue(raw: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.includes('點') || raw.includes('.')) {
    const parts = raw.split(/[點.]/);
    if (parts.length !== 2 || !parts[1]) return null;
    const integer = numericValue(parts[0]);
    const decimals = [...parts[1]].map((char) => /\d/.test(char) ? char : digits[char]);
    return integer !== null && decimals.every((char) => char !== undefined)
      ? integer + Number('0.' + decimals.join('')) : null;
  }
  if (!/^[零〇○一二兩三四五六七八九十百千萬]+$/.test(raw)) return null;
  if (![...raw].some((char) => '十百千萬'.includes(char))) {
    return Number([...raw].map((char) => digits[char]).join(''));
  }
  let total = 0;
  let section = 0;
  let number = 0;
  for (const char of raw) {
    if (char in digits) number = digits[char];
    else if (char === '萬') {
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
    if (numerator === null || denominator === null || denominator <= 0 || !Number.isInteger(numerator) || !Number.isInteger(denominator)) return null;
    const kind = fraction || normalized.includes('/') ? 'fraction' : 'ratio';
    return kind + ':' + numerator + '/' + denominator;
  }
  if (!/^[\d零〇○一二兩三四五六七八九十百千萬點.]+$/.test(normalized)) return null;
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

export interface ClozeSession {
  version: string;
  category: string;
  order: string[];
  index: number;
  answers: string[];
  submitted: boolean;
  results: Record<string, string[]>;
}

export function createClozeSession(category = '全部', random = Math.random): ClozeSession {
  const pool = data.questions.filter((q) => category === '全部' || q.category === category);
  const order = pool.map((q) => q.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { version: data.version, category, order, index: 0, answers: [], submitted: false, results: {} };
}

export function parseClozeSession(raw: string | null): ClozeSession | null {
  try {
    const value = JSON.parse(raw ?? 'null') as ClozeSession | null;
    if (!value || value.version !== data.version || !['全部', ...clozeCategories].includes(value.category)) return null;
    const pool = data.questions.filter((q) => value.category === '全部' || q.category === value.category);
    if (!Array.isArray(value.order) || value.order.length !== pool.length || new Set(value.order).size !== pool.length || !value.order.every((id) => pool.some((q) => q.id === id))) return null;
    if (!Number.isInteger(value.index) || value.index < 0 || value.index >= value.order.length || typeof value.submitted !== 'boolean') return null;
    const validAnswers = (answers: unknown): answers is string[] => Array.isArray(answers) && answers.length <= 10 && answers.every((a) => typeof a === 'string' && a.length <= 50);
    if (!validAnswers(value.answers) || !value.results || typeof value.results !== 'object' || Array.isArray(value.results)) return null;
    const results: Record<string, string[]> = {};
    for (const [id, answers] of Object.entries(value.results)) {
      const question = pool.find((q) => q.id === id);
      if (question && validAnswers(answers) && answers.length === question.blanks.length) results[id] = answers;
    }
    const question = pool.find((q) => q.id === value.order[value.index])!;
    if (value.submitted && (!results[question.id] || value.answers.length !== question.blanks.length || value.answers.some((a, i) => a !== results[question.id][i]))) return null;
    return { ...value, results };
  } catch {
    return null;
  }
}
