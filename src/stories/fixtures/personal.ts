import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { parseQuestionId } from '@/lib/question-path';
import { createAttempt, isQuestionCorrect } from '@/lib/study';
import type { AppState, Question, QuizAttempt, SubjectId } from '@/lib/types';
import { appReducer } from '@/state/app-reducer';
import {
  createStoryState,
  FIXTURE_NOW,
  fixtureImages,
  fixtureNoteContent,
} from './app-state';
import {
  fixtureQuestionsFor,
  fixtureSubjectQuestions,
  getFixtureQuestion,
} from './questions';

/*
 * 我的作答存摺（使用者筆記、難題標記、常錯題目、已作答紀錄）的範例資料。
 * 作答紀錄都用網站的判分規則產生，答對／答錯／未作答數一定跟答案一致。
 */

// ---------- 題庫 ----------

/** 依題目編號取題目，順序照傳入的編號。 */
function questionsOf(questionIds: readonly string[]): Question[] {
  return questionIds.map(getFixtureQuestion);
}

/** 四科題庫都下載完成，`overrides` 換掉其中幾科的狀態（載入中、載入失敗）。 */
export function questionBankStatusesWith(
  overrides: Partial<Record<SubjectId, QuestionBankStatus>> = {},
): Record<SubjectId, QuestionBankStatus> {
  return {
    law: 'ready',
    env: 'ready',
    construction: 'ready',
    structure: 'ready',
    ...overrides,
  };
}

/**
 * 難題標記、常錯題目、已作答紀錄的頁面只載入這些題目用到的科目與年度（整份試卷）。
 * 用頁面的 props 固定狀態的故事拿這個當「已載入」的題目；給了 `statuses` 就只留下
 * 已下載完成的科目，沒給就是全部載入完成。
 */
export function loadedPapersOf(
  questionIds: readonly string[],
  statuses?: Record<SubjectId, QuestionBankStatus>,
): Question[] {
  const papers = new Set(
    questionIds.flatMap((questionId) => {
      const parsed = parseQuestionId(questionId);
      return parsed ? [`${parsed.subject}:${parsed.year}`] : [];
    }),
  );
  return fixtureSubjectQuestions().filter(
    (question) =>
      papers.has(`${question.subject}:${question.year}`) &&
      (!statuses || statuses[question.subject] === 'ready'),
  );
}

// ---------- 作答紀錄 ----------

/** 答對的選項（一律給分題選第一個）。 */
function correctOption(question: Question) {
  const index = question.options.findIndex((_, option) =>
    isQuestionCorrect(question, option),
  );
  return Math.max(index, 0);
}

/** 答錯的選項：依題號挑一個錯的，畫面上的「你的答案」才不會都一樣。一律給分題沒有錯的選項。 */
function wrongOption(question: Question) {
  const wrong = question.options
    .map((_, option) => option)
    .filter((option) => !isQuestionCorrect(question, option));
  return wrong.length ? wrong[question.questionNumber % wrong.length] : undefined;
}

function startedBefore(submittedAt: string, elapsedSeconds: number) {
  return new Date(Date.parse(submittedAt) - elapsedSeconds * 1000).toISOString();
}

/**
 * 歷屆試題模擬考的交卷紀錄：整份試卷的選擇題，`wrong`／`unanswered` 列出答錯／沒作答的
 * 題號，其餘答對。分數與題數用網站的 createAttempt 計算。
 */
function paperAttempt({
  id,
  subject,
  year,
  wrong = [],
  unanswered = [],
  submittedAt,
  elapsedSeconds = 7200,
}: {
  id: string;
  subject: SubjectId;
  year: number;
  wrong?: readonly number[];
  unanswered?: readonly number[];
  submittedAt: string;
  elapsedSeconds?: number;
}): QuizAttempt {
  const source = fixtureQuestionsFor(subject, year).filter(
    (question) => question.format !== 'written',
  );
  const answers: Record<string, number> = {};
  source.forEach((question) => {
    if (unanswered.includes(question.questionNumber)) return;
    const selected = wrong.includes(question.questionNumber)
      ? wrongOption(question)
      : correctOption(question);
    answers[question.id] = selected ?? correctOption(question);
  });
  const startedAt = startedBefore(submittedAt, elapsedSeconds);
  return {
    ...createAttempt({ mode: 'paper', source, answers, startedAt, elapsedSeconds }),
    id,
    startedAt,
    submittedAt,
  };
}

/**
 * 選擇題練習的交卷紀錄，欄位照 createPracticeAttempt：年度一律是 null，
 * 只算有作答的題目。`wrong`／`unanswered` 是答錯／沒作答的題目編號。
 */
function practiceAttempt({
  id,
  questionIds,
  wrong = [],
  unanswered = [],
  submittedAt,
  elapsedSeconds,
}: {
  id: string;
  questionIds: readonly string[];
  wrong?: readonly string[];
  unanswered?: readonly string[];
  submittedAt: string;
  elapsedSeconds?: number;
}): QuizAttempt {
  const questions = questionsOf(questionIds);
  const answers: Record<string, number> = {};
  questions.forEach((question) => {
    if (unanswered.includes(question.id)) return;
    answers[question.id] = wrong.includes(question.id)
      ? (wrongOption(question) ?? correctOption(question))
      : correctOption(question);
  });
  const answered = Object.keys(answers);
  const correctCount = questions.filter(
    (question) =>
      answers[question.id] !== undefined &&
      isQuestionCorrect(question, answers[question.id]),
  ).length;
  const seconds = elapsedSeconds ?? answered.length * 41;
  return {
    id,
    mode: 'practice',
    subject: questions[0].subject,
    year: null,
    questionIds: [...questionIds],
    answers,
    startedAt: startedBefore(submittedAt, seconds),
    submittedAt,
    elapsedSeconds: seconds,
    correctCount,
    wrongCount: answered.length - correctCount,
    unansweredCount: questions.length - answered.length,
  };
}

/** 法規 113 年第 1 次：錯 15 題、最後 2 題沒寫完。 */
const law113FirstAttempt = paperAttempt({
  id: 'story-attempt-law-113-1',
  subject: 'law',
  year: 113,
  wrong: [2, 5, 9, 14, 17, 21, 26, 27, 33, 41, 47, 52, 58, 63, 70],
  unanswered: [79, 80],
  submittedAt: '2026-10-05T04:10:00.000Z',
  elapsedSeconds: 7140,
});

/** 法規 113 年第 2 次：同一份試卷再做一次，有幾題又錯。 */
const law113SecondAttempt = paperAttempt({
  id: 'story-attempt-law-113-2',
  subject: 'law',
  year: 113,
  wrong: [5, 9, 17, 27, 33, 52],
  submittedAt: '2026-10-12T05:40:00.000Z',
  elapsedSeconds: 6020,
});

/** 法規 101 年：含圖片的第 8 題與截圖的第 15 題答錯。 */
const law101Attempt = paperAttempt({
  id: 'story-attempt-law-101-1',
  subject: 'law',
  year: 101,
  wrong: [3, 8, 15, 22, 27, 40, 55, 61],
  submittedAt: '2026-09-28T07:25:00.000Z',
  elapsedSeconds: 6580,
});

/** 法規選擇題練習 20 題（101、113 年混合），錯 5 題、1 題沒作答。 */
const lawPracticeAttempt = practiceAttempt({
  id: 'story-attempt-law-practice-1',
  questionIds: [
    'law-113-05',
    'law-101-15',
    'law-113-09',
    'law-101-08',
    'law-113-17',
    'law-101-03',
    'law-113-21',
    'law-101-27',
    'law-113-33',
    'law-101-40',
    'law-113-01',
    'law-101-11',
    'law-113-12',
    'law-101-22',
    'law-113-27',
    'law-101-30',
    'law-113-40',
    'law-101-45',
    'law-113-60',
    'law-101-61',
  ],
  wrong: ['law-113-05', 'law-101-15', 'law-101-08', 'law-113-33', 'law-113-27'],
  unanswered: ['law-101-61'],
  submittedAt: '2026-10-18T13:05:00.000Z',
});

/** 構造 113 年模擬考。 */
const construction113Attempt = paperAttempt({
  id: 'story-attempt-construction-113-1',
  subject: 'construction',
  year: 113,
  wrong: [6, 12, 24, 31, 44, 50, 66, 72],
  submittedAt: '2026-10-15T06:00:00.000Z',
  elapsedSeconds: 5400,
});

/** 環控 113 年模擬考（只算 40 題選擇題）。 */
const env113Attempt = paperAttempt({
  id: 'story-attempt-env-113-1',
  subject: 'env',
  year: 113,
  wrong: [5, 11, 23, 30],
  unanswered: [40],
  submittedAt: '2026-10-16T02:30:00.000Z',
  elapsedSeconds: 3900,
});

/** 結構選擇題練習 10 題。 */
const structurePracticeAttempt = practiceAttempt({
  id: 'story-attempt-structure-practice-1',
  questionIds: [
    'structure-113-05',
    'structure-113-16',
    'structure-113-01',
    'structure-113-08',
    'structure-113-12',
    'structure-113-20',
    'structure-113-25',
    'structure-113-30',
    'structure-113-33',
    'structure-113-38',
  ],
  wrong: ['structure-113-05', 'structure-113-16', 'structure-113-25'],
  submittedAt: '2026-10-19T11:45:00.000Z',
});

/** 四科都有的作答紀錄（新到舊，跟網站存檔的順序一樣）。 */
export const personalAttempts: QuizAttempt[] = [
  structurePracticeAttempt,
  lawPracticeAttempt,
  env113Attempt,
  construction113Attempt,
  law113SecondAttempt,
  law113FirstAttempt,
  law101Attempt,
];

/** 全部答對的紀錄：有作答紀錄但沒有錯題。 */
export const perfectAttempts: QuizAttempt[] = [
  practiceAttempt({
    id: 'story-attempt-law-practice-perfect',
    questionIds: ['law-113-01', 'law-113-03', 'law-101-15', 'law-101-03', 'law-113-12'],
    submittedAt: '2026-10-19T09:00:00.000Z',
  }),
  paperAttempt({
    id: 'story-attempt-law-113-perfect',
    subject: 'law',
    year: 113,
    submittedAt: '2026-10-17T05:00:00.000Z',
  }),
];

/**
 * 跨科目、跨年度的舊紀錄（科目 mixed、年度 null）：現在的練習與模擬考都只出單一科目，
 * 不會再產生這種紀錄，但網站仍會讀進來，已作答紀錄會多一個「跨科目」分類，
 * 分數顯示「無法計算分數」。
 */
export const legacyMixedAttempt: QuizAttempt = {
  ...createAttempt({
    mode: 'paper',
    source: questionsOf([
      'law-101-03',
      'env-113-05',
      'construction-113-12',
      'structure-113-05',
    ]),
    answers: {
      'law-101-03': 1,
      'env-113-05': 0,
      'construction-113-12': 3,
      'structure-113-05': 2,
    },
    startedAt: '2026-06-02T01:00:00.000Z',
    elapsedSeconds: 420,
  }),
  id: 'story-attempt-legacy-mixed',
  submittedAt: '2026-06-02T01:07:00.000Z',
};

/**
 * 範例題庫沒有的年度（法規只有 101、113、114 年）：題目載入後是空的，畫面只能顯示
 * 紀錄裡的統計數字，跟題目已從題庫移除的舊紀錄一樣。80 題都有作答，答對＋答錯＝80。
 */
function outOfBankLawAttempt(year: number, submittedAt: string, correctCount: number) {
  const questionIds = Array.from(
    { length: 80 },
    (_, number) => `law-${year}-${String(number + 1).padStart(2, '0')}`,
  );
  return {
    id: `story-attempt-law-${year}`,
    mode: 'paper',
    subject: 'law',
    year,
    questionIds,
    answers: Object.fromEntries(questionIds.map((id, index) => [id, index % 4])),
    startedAt: startedBefore(submittedAt, 6600),
    submittedAt,
    elapsedSeconds: 6600,
    correctCount,
    wrongCount: 80 - correctCount,
    unansweredCount: 0,
  } satisfies QuizAttempt;
}

/**
 * 法規每一個收錄年度（100–114 年）都做過一次模擬考：「已完成所有年度」。
 * 範例題庫有的年度照實際答案產生，其他年度只有統計數字。
 */
export const allLawYearAttempts: QuizAttempt[] = Array.from(
  { length: 15 },
  (_, index) => {
    const year = 114 - index;
    const submittedAt = new Date(
      Date.parse(FIXTURE_NOW) - (index + 1) * 86_400_000,
    ).toISOString();
    return fixtureQuestionsFor('law', year).length
      ? paperAttempt({
          id: `story-attempt-law-${year}`,
          subject: 'law',
          year,
          wrong: [3, 9, 15, 27, 33],
          submittedAt,
        })
      : outOfBankLawAttempt(year, submittedAt, 64 + (index % 9));
  },
);

/**
 * 照網站交卷的流程（save-attempt）由舊到新存入作答紀錄：紀錄新到舊排列，
 * 每題的最近一次作答也會寫進 answers，跟實際存檔一樣。
 */
export function attemptsAppState(attempts: readonly QuizAttempt[]): Partial<AppState> {
  const questionById = new Map(
    attempts
      .flatMap((attempt) => attempt.questionIds)
      .flatMap((questionId) => {
        try {
          return [[questionId, getFixtureQuestion(questionId)] as const];
        } catch {
          return [];
        }
      }),
  );
  const state = [...attempts]
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
    .reduce(
      (current, attempt) =>
        appReducer(current, {
          type: 'save-attempt',
          attempt,
          results: Object.fromEntries(
            Object.entries(attempt.answers).map(([questionId, selected]) => {
              const question = questionById.get(questionId);
              return [
                questionId,
                question ? isQuestionCorrect(question, selected) : false,
              ];
            }),
          ),
        }),
      createStoryState(),
    );
  return { attempts: state.attempts, answers: state.answers };
}

// ---------- 難題 ----------

/** 四科都有標記的難題。 */
export const personalDifficultIds = [
  'law-113-03',
  'law-113-27',
  'law-113-33',
  'law-113-05',
  'law-101-15',
  'law-101-08',
  'env-113-23',
  'construction-113-24',
  'structure-113-16',
  'structure-113-05',
];

// ---------- 筆記 ----------

export const personalNotes: AppState['notes'] = {
  'law-113-03':
    '**建築法第 44 條**：基地畸零狹小，要和鄰地_協議調整地形或合併使用_才可以建築。\n!!最小寬度與深度由直轄市、縣（市）政府訂定!!，不是中央主管建築機關。\n建築基地與建築線相連接的最小寬度另由地方規定，以 m 計（不是 m^2^）。',
  'law-113-27':
    '**防火區劃免區劃的例外**：電影院觀眾席、體育館、工廠生產線、_零售市場_ 這類「必要大空間」才可以不受 1500 m^2^ 限制。\n!!美食街不是!!，要照一般規定區劃。',
  'law-113-05': '勘驗：**承造人會同監造人**申報。\n口訣：_造的人蓋、監的人看_。',
  'law-113-33': '有效日照 **1 小時以上**；兩幢建築物的陰影要合併檢討。',
  'law-101-15': fixtureNoteContent,
  'env-113-23':
    '熱傳透率 U 值越小越隔熱。\n改裝後白天穩態：Q = U・A・ΔT，**窗面積變大 → 熱得增加**。\nCO~2~ 濃度與換氣量另題。',
  'env-113-written-01':
    '**景觀貯留滲透水池**：平時是景觀水池，下雨時暫存雨水再慢慢入滲。\n作答重點：\n1. 繪圖標出溢流口、滲透層、礫石層\n2. 基地保水指標 λ ≥ λc\n3. !!不可只寫「透水鋪面」!!',
  'construction-113-24': '圖例的接合只傳軸力與剪力、**不傳彎矩** → 鉸接合。',
  'structure-113-16': '塑性鉸數 ≥ 靜不定度 + 1 才會形成機構。',
};

export const personalNoteImages: AppState['noteImages'] = {
  'law-113-27': fixtureImages.slice(0, 2),
  'law-101-15': fixtureImages.slice(0, 2),
  // 只有圖片、沒有文字的筆記：已儲存筆記會顯示「圖片筆記 1 張」。
  'law-113-17': [fixtureImages[3]],
  'construction-113-24': [fixtureImages[2]],
  'env-113-written-01': [fixtureImages[1]],
};

const personalNoteUpdatedAt: AppState['noteUpdatedAt'] = Object.fromEntries(
  Object.keys(personalNotes).map((questionId, index) => [
    questionId,
    new Date(Date.parse(FIXTURE_NOW) - index * 3_600_000).toISOString(),
  ]),
);

/** 很長的筆記：整理整個章節的重點。 */
const longNoteContent = [
  '**建築法第 5 條：供公眾使用之建築物**',
  '供公眾工作、營業、居住、遊覽、娛樂及其他供公眾使用之建築物。',
  '',
  '施行細則列舉（都市計畫範圍內、總樓地板面積 1000 m^2^ 以上）：',
  '1. 戲院、電影院、演藝場、歌廳、舞廳',
  '2. 旅館、市場、百貨公司、商場、超級市場',
  '3. 醫院、療養院、育幼院、托兒所',
  '4. 學校、補習班、體育館、展覽館、圖書館',
  '5. 辦公廳、工廠（含私人辦公大樓）',
  '6. _6 層以上_ 之集合住宅（公寓）',
  '',
  '!!易錯：5 層樓集合住宅不算!!，必須 6 層以上才算。',
  '對照：建築技術規則建築設計施工編第 1 條用語定義。',
  '',
  '延伸：供公眾使用建築物要定期辦理公共安全檢查簽證及申報（建築法第 77 條），',
  '非供公眾使用建築物則由主管機關認有必要時才檢查。',
].join('\n');

/**
 * 筆記頁用的本機資料：四科都有筆記，幾題同時標成難題。101 年第 15 題換成很長的筆記，
 * 在同一個故事裡換題就能看到。
 */
export const notesAppState: Partial<AppState> = {
  notes: { ...personalNotes, 'law-101-15': longNoteContent },
  noteImages: personalNoteImages,
  noteUpdatedAt: personalNoteUpdatedAt,
  difficultQuestionIds: ['law-113-03', 'law-113-27', 'law-113-33', 'law-101-15'],
};
