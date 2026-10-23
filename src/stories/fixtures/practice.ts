import { clozeBank } from '@/features/law-cloze/cloze';
import { buildPracticeOverview } from '@/features/practice/practice-overview';
import {
  confirmPracticeAnswer,
  createPracticeSession,
  createPracticeSessionFromQuestions,
  DEFAULT_PRACTICE_SETTINGS,
  getDisplayedQuestion,
  resolvePracticePool,
  selectPracticeOption,
  tickPracticeTimer,
  type PracticeSession,
  type PracticeSettings,
} from '@/features/practice/practice-session';
import { isQuestionCorrect } from '@/lib/study';
import type { DiscussionPost, Question, SubjectId } from '@/lib/types';
import { FIXTURE_NOW, fixtureImages } from './app-state';
import { fixtureSubjectQuestions, getFixtureQuestion } from './questions';

/**
 * 每日練習總覽（/practice）的統計，跟 src/pages/practice.tsx 的 getStaticProps 一樣：
 * 題庫只取選擇題（getMultipleChoiceQuestions），再加上法規克漏字題庫。數字是範例題庫的
 * 規模，比實際網站少。
 */
export const practiceOverview = buildPracticeOverview(
  fixtureSubjectQuestions().filter((question) => question.format === 'multiple-choice'),
  clozeBank,
);

/** 固定種子的亂數（mulberry32）：抽題、打亂選項跟網站同一套規則，但每次打開都一樣。 */
function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 選擇題練習頁載入一科後的題庫（範例題庫只有法規 101、113、114 年等幾份試卷）。
 * 網站從新到舊逐年載入，順序跟伺服器端題庫一樣，同一組亂數才會抽到同樣的題目。
 */
export function practiceBank(subject: SubjectId = 'law'): Question[] {
  return fixtureSubjectQuestions(subject);
}

/** 跟 PracticePage 一樣，用題庫和設定算出抽題範圍。 */
function practicePool(
  subject: SubjectId = 'law',
  settings: PracticeSettings = DEFAULT_PRACTICE_SETTINGS,
  questions: readonly Question[] = practiceBank(subject),
) {
  return resolvePracticePool(questions, subject, settings);
}

/** 按「線上作答」抽出的題組：網站的抽題規則，亂數固定。 */
export function drawPracticeSession({
  id,
  subject = 'law',
  settings = DEFAULT_PRACTICE_SETTINGS,
  seed = 113,
}: {
  id: string;
  subject?: SubjectId;
  settings?: PracticeSettings;
  seed?: number;
}): PracticeSession {
  const pool = practicePool(subject, settings);
  return {
    ...createPracticeSession(pool, subject, settings.shuffleOptions, seededRandom(seed)),
    id,
  };
}

/**
 * 指定題目的題組，範圍與類別照預設設定的抽題範圍，方便把截圖題、含圖片的題目放進來。
 * 選項照網站預設打亂（亂數固定）。
 */
export function practiceSessionOf(
  id: string,
  questionIds: readonly string[],
  { subject = 'law', seed = 101 }: { subject?: SubjectId; seed?: number } = {},
): PracticeSession {
  const pool = practicePool(subject);
  return {
    ...createPracticeSessionFromQuestions(
      questionIds.map(getFixtureQuestion),
      subject,
      DEFAULT_PRACTICE_SETTINGS.shuffleOptions,
      seededRandom(seed),
    ),
    id,
    rangeStart: pool.rangeStart,
    rangeEnd: pool.rangeEnd,
    category: pool.category,
  };
}

/** 'correct'／'wrong' 會挑一個答對／答錯的選項（畫面上的順序），數字就是直接選那個選項。 */
type PracticeChoice = 'correct' | 'wrong' | number;

function defaultSeconds(question: Question) {
  return 18 + ((question.questionNumber * 37 + question.year) % 70);
}

/**
 * 照網站的流程作答：題目開著時計時，選擇後按「確認答案」，對錯由網站的判分規則決定，
 * 所以答對／答錯數一定跟答案一致。
 */
export function answerPractice(
  session: PracticeSession,
  choices: Record<string, PracticeChoice>,
  seconds: Record<string, number> = {},
): PracticeSession {
  return Object.entries(choices).reduce((current, [questionId, choice]) => {
    const source = getFixtureQuestion(questionId);
    const displayed = getDisplayedQuestion(current, source);
    const selected =
      typeof choice === 'number'
        ? choice
        : displayed.options.findIndex(
            (_, index) => isQuestionCorrect(displayed, index) === (choice === 'correct'),
          );
    if (selected < 0) throw new Error(`${questionId} 沒有${choice}的選項`);
    const timed = tickPracticeTimer(
      current,
      questionId,
      seconds[questionId] ?? defaultSeconds(source),
    );
    return confirmPracticeAnswer(
      selectPracticeOption(timed, questionId, selected),
      displayed,
    );
  }, session);
}

/** 依題組順序作答前幾題，pattern 依序循環（例如 對、對、錯）。 */
export function answerFirst(
  session: PracticeSession,
  count: number,
  pattern: readonly ('correct' | 'wrong')[] = ['correct', 'correct', 'wrong'],
): PracticeSession {
  const choices: Record<string, PracticeChoice> = {};
  session.questionIds.slice(0, count).forEach((questionId, index) => {
    const question = getFixtureQuestion(questionId);
    const wanted = pattern[index % pattern.length];
    // 一律給分的題目選什麼都算對。
    choices[questionId] = question.answerKey.kind === 'all-credit' ? 'correct' : wanted;
  });
  return answerPractice(session, choices);
}

/**
 * 截圖那題（建築法第 5 條）的本機社群投稿（Storybook 不連 Firebase，網站改讀本機資料）：
 * 詳解、補充會出現在練習的詳解區，提問不會。
 */
export function practiceDiscussionPosts(questionId: string): DiscussionPost[] {
  return [
    {
      id: `story-post-${questionId}-explanation`,
      questionId,
      type: 'explanation',
      content:
        '關鍵在**建築法第 5 條**的「供公眾使用」：集合住宅要 _6 層以上_ 才列入，5 層樓不算。',
      images: [fixtureImages[0]],
      createdAt: FIXTURE_NOW,
      likes: 12,
      replies: [],
      reported: false,
    },
    {
      id: `story-post-${questionId}-supplement`,
      questionId,
      type: 'supplement',
      content:
        '補充：工廠、市場、私人辦公大樓（總樓地板面積 1000 m^2^ 以上）都屬供公眾使用。',
      images: [],
      createdAt: '2026-10-18T03:12:00.000Z',
      likes: 4,
      replies: [],
      reported: false,
    },
    {
      id: `story-post-${questionId}-question`,
      questionId,
      type: 'question',
      content: '請問 6 層以上是指地上層數嗎？',
      images: [],
      createdAt: '2026-10-19T11:40:00.000Z',
      likes: 0,
      replies: [],
      reported: false,
    },
  ];
}
