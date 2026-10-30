import {
  CLOZE_STORAGE_KEY,
  clozeBank,
  gradeCloze,
  parseClozeSession,
  type ClozeQuestion,
  type ClozeSession,
} from '@/features/law-cloze/cloze';
import {
  buildMockExamPapers,
  createMockExamAttempt,
  getMockExamQuestions,
  mockExamQuestionId,
  mockExamScope,
} from '@/features/practice/mock-exam';
import {
  composeQuizProgress,
  QUIZ_PROGRESS_STORAGE_KEY,
  type QuizProgressByQuestion,
} from '@/features/practice/mock-exam-progress';
import { isQuestionCorrect } from '@/lib/study';
import type { AppState, Question, QuizAttempt, SubjectId } from '@/lib/types';
import { appReducer } from '@/state/app-reducer';
import {
  createStoryState,
  FIXTURE_NOW,
  fixtureImages,
  fixtureNoteContent,
} from './app-state';
import { fixtureQuestions, fixtureQuestionsFor, getFixtureQuestion } from './questions';

/* ------------------------------------------------------------------ */
/* 歷屆試題模擬考                                                       */
/* ------------------------------------------------------------------ */

const bankYears = Array.from({ length: 15 }, (_, index) => 100 + index);

/**
 * 實際題庫（public/question-data）每份試卷的題數：法規、構造每年 80 題選擇題；環控、結構
 * 每年 40 題選擇題，另有 2～3 題申論題。
 */
const bankPapers: Record<SubjectId, { choice: number; written: number[] }> = {
  law: { choice: 80, written: bankYears.map(() => 0) },
  env: { choice: 40, written: [2, 3, 2, 3, 3, 2, 3, 2, 2, 2, 2, 2, 3, 3, 3] },
  construction: { choice: 80, written: bankYears.map(() => 0) },
  structure: { choice: 40, written: [2, 3, 2, 2, 3, 2, 3, 2, 2, 2, 2, 3, 3, 2, 2] },
};

type PaperSource = Parameters<typeof buildMockExamPapers>[0][number];

/** 範例題庫有的試卷用實際題目，其他年度照實際題數補上題號（選卷畫面只需要題數）。 */
function paperSources(): PaperSource[] {
  return (Object.keys(bankPapers) as SubjectId[]).flatMap((subject) =>
    bankYears.flatMap((year, yearIndex): PaperSource[] => {
      const fixture = fixtureQuestionsFor(subject, year);
      if (fixture.length) return fixture;
      const { choice, written } = bankPapers[subject];
      return [
        ...Array.from({ length: choice }, (_, index) => ({
          id: mockExamQuestionId(subject, year, index + 1),
          format: 'multiple-choice' as const,
          subject,
          year,
          questionNumber: index + 1,
        })),
        ...Array.from({ length: written[yearIndex] }, (_, index) => ({
          id: `${subject}-${year}-written-${String(index + 1).padStart(2, '0')}`,
          format: 'written' as const,
          subject,
          year,
          questionNumber: index + 1,
        })),
      ];
    }),
  );
}

/**
 * 跟 /practice/mock-exam 的 getStaticProps 一樣，用 buildMockExamPapers 從題目摘要算出
 * 試卷清單：四科、100～114 年，共 60 份試卷。只有範例題庫裡的試卷（法規 101、113、114 年，
 * 環控、構造、結構 113 年）能載入題目作答；其他年度載入後會是「找不到這一題」。
 */
export const mockExamPapers = buildMockExamPapers(paperSources());

/** 試卷清單裡的一份試卷。 */
export function mockExamPaper(subject: SubjectId, year: number) {
  const paper = mockExamPapers.find(
    (item) => item.subject === subject && item.year === year,
  );
  if (!paper) throw new Error(`試卷清單沒有 ${subject} ${year} 年`);
  return paper;
}

/** 範例題庫裡一份試卷的選擇題，照題號排列。 */
export function mockExamPaperQuestions(subject: SubjectId, year: number) {
  return getMockExamQuestions(fixtureQuestions, subject, year);
}

function correctOption(question: Question) {
  return question.answerKey.kind === 'accepted' ? question.answerKey.options[0] : 0;
}

function wrongOption(question: Question) {
  const accepted =
    question.answerKey.kind === 'accepted' ? question.answerKey.options : [];
  return question.options.findIndex((_, index) => !accepted.includes(index));
}

/** 用題號描述一份作答：哪些題答錯、哪些題沒作答，其餘都答對。 */
interface PaperAnswerPlan {
  subject: SubjectId;
  year: number;
  /** 作答到第幾題為止（含），之後都沒作答；不給就是整份試卷。 */
  through?: number;
  wrong?: readonly number[];
  blank?: readonly number[];
  /** 指定某幾題選的選項（0 起算），例如答錯時選 D；沒指定的答錯題選第一個錯的選項。 */
  picks?: Readonly<Record<number, number>>;
}

/** 依作答計畫算出每題選的選項（題號 → 0 起算的選項）。 */
function planPaperAnswers({
  subject,
  year,
  through,
  wrong = [],
  blank = [],
  picks = {},
}: PaperAnswerPlan): Record<number, number> {
  const questions = mockExamPaperQuestions(subject, year);
  const last = through ?? bankPapers[subject].choice;
  return Object.fromEntries(
    Array.from({ length: last }, (_, index) => index + 1).flatMap((number) => {
      if (blank.includes(number)) return [];
      if (picks[number] !== undefined) return [[number, picks[number]]];
      const question = questions.find((item) => item.questionNumber === number);
      // 範例題庫沒有的試卷沒有標準答案，選項依題號輪流。
      if (!question) return [[number, (number * 3) % 4]];
      return [
        [
          number,
          wrong.includes(number) ? wrongOption(question) : correctOption(question),
        ],
      ];
    }),
  );
}

const DRAFT_STARTED_AT = Date.parse('2026-10-20T08:40:00.000Z');

/** 一題的作答進度。 */
interface DraftEntry {
  selected?: number;
  eliminatedOptions?: number[];
  /** 待檢查。 */
  review?: boolean;
  /** 這題花的秒數，預設 62 秒。 */
  seconds?: number;
}

/**
 * 一份試卷的作答進度，跟網站存的格式一樣：每題記錄選項、刪去的選項、作答秒數與開始時間；
 * 時間從 2026-10-20 08:40（UTC）依題號往後排。
 */
function mockExamDraft(
  subject: SubjectId,
  year: number,
  entries: Record<number, DraftEntry>,
): QuizProgressByQuestion {
  let clock = DRAFT_STARTED_AT;
  return Object.fromEntries(
    Object.entries(entries)
      .map(([number, entry]) => [Number(number), entry] as const)
      .sort(([left], [right]) => left - right)
      .map(([number, entry]) => {
        const elapsedSeconds = entry.seconds ?? 62;
        const startedAt = new Date(clock).toISOString();
        clock += elapsedSeconds * 1000;
        return [
          mockExamQuestionId(subject, year, number),
          {
            ...(entry.selected === undefined ? {} : { selected: entry.selected }),
            ...(entry.eliminatedOptions?.length
              ? { eliminatedOptions: entry.eliminatedOptions }
              : {}),
            ...(entry.review ? { review: true } : {}),
            elapsedSeconds,
            startedAt,
            updatedAt: new Date(clock).toISOString(),
          },
        ];
      }),
  );
}

/**
 * 作答計畫轉成作答進度：作答到 `through` 為止的每題都打開過（跳過的題目沒有選項）；
 * `current` 是後面再打開的題目，例如目前這題。
 */
function plannedDraft(
  plan: PaperAnswerPlan,
  current: Record<number, DraftEntry> = {},
  review: readonly number[] = [],
) {
  const answers = planPaperAnswers(plan);
  const entries: Record<number, DraftEntry> = {};
  const last = plan.through ?? bankPapers[plan.subject].choice;
  for (let number = 1; number <= last; number += 1) {
    entries[number] = {
      selected: answers[number],
      review: review.includes(number) || undefined,
      seconds: 40 + ((number * 17) % 55),
    };
  }
  return mockExamDraft(plan.subject, plan.year, { ...entries, ...current });
}

/** parameters.localStorage：把幾份試卷的作答進度存成網站的格式。 */
function mockExamDraftStorage(
  drafts: ReadonlyArray<{
    subject: SubjectId;
    year: number;
    progress: QuizProgressByQuestion;
  }>,
) {
  const raw = drafts.reduce<string | null>(
    (stored, draft) =>
      composeQuizProgress(
        stored,
        mockExamScope(draft.subject, draft.year),
        draft.progress,
      ),
    null,
  );
  return raw ? { [QUIZ_PROGRESS_STORAGE_KEY]: raw } : {};
}

/**
 * 交卷後存進「已作答紀錄」的成績，用網站的 createMockExamAttempt 依標準答案計分，
 * 再固定 id 與交卷時間。只能用範例題庫有的試卷。
 */
function mockExamAttempt({
  id,
  submittedAt = FIXTURE_NOW,
  ...plan
}: PaperAnswerPlan & { id: string; submittedAt?: string }): QuizAttempt {
  const questions = mockExamPaperQuestions(plan.subject, plan.year);
  if (!questions.length) {
    throw new Error(`範例題庫沒有 ${plan.subject} ${plan.year} 年的試卷`);
  }
  const answers = planPaperAnswers(plan);
  const progress = mockExamDraft(
    plan.subject,
    plan.year,
    Object.fromEntries(
      questions.map((question) => [
        question.questionNumber,
        { selected: answers[question.questionNumber], seconds: 48 },
      ]),
    ),
  );
  const attempt = createMockExamAttempt(questions, progress);
  const startedAt = new Date(
    Date.parse(submittedAt) - attempt.elapsedSeconds * 1000,
  ).toISOString();
  return { ...attempt, id, startedAt, submittedAt };
}

/**
 * parameters.appState 的作答紀錄：照網站交卷（save-attempt）的方式由舊到新存入成績。
 * 已作答紀錄新到舊排列，每題最近一次的作答也寫進 answers，跟實際存檔一樣。
 */
function mockExamAppState(
  attempts: readonly QuizAttempt[],
): Pick<AppState, 'attempts' | 'answers'> {
  const state = [...attempts]
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
    .reduce(
      (current, attempt) =>
        appReducer(current, {
          type: 'save-attempt',
          attempt,
          results: Object.fromEntries(
            attempt.questionIds.map((questionId) => [
              questionId,
              isQuestionCorrect(
                getFixtureQuestion(questionId),
                attempt.answers[questionId],
              ),
            ]),
          ),
        }),
      createStoryState(),
    );
  return { attempts: state.attempts, answers: state.answers };
}

/**
 * 正在重考的法規 101 年：第 1～14 題作答完（第 8 題題幹有圖片、第 11 題都先跳過），
 * 停在第 15 題（建築法第 5 條），選了 D 並刪去 B、C。
 */
export const law101Draft = plannedDraft(
  { subject: 'law', year: 101, through: 14, blank: [8, 11] },
  { 15: { selected: 3, eliminatedOptions: [1, 2], seconds: 35 } },
  [6, 14],
);

/** 法規 109 年（範例題庫沒有題目）：做了前 12 題就先離開。 */
const law109Draft = plannedDraft({ subject: 'law', year: 109, through: 12 });

/** 一週前交卷的法規 113 年：答錯 14 題（82.50 分）。 */
const law113EarlierAttempt = mockExamAttempt({
  id: 'attempt-2026-10-12T11:20:00.000Z-law113',
  submittedAt: '2026-10-12T11:20:00.000Z',
  subject: 'law',
  year: 113,
  wrong: [3, 11, 12, 19, 22, 28, 35, 40, 47, 52, 63, 70, 74, 78],
});

/** 第一次考法規 101 年：答錯 6 題，其中第 12、15、41 題上次考又錯。 */
const law101EarlierAttempt = mockExamAttempt({
  id: 'attempt-2026-10-13T12:10:00.000Z-law101',
  submittedAt: '2026-10-13T12:10:00.000Z',
  subject: 'law',
  year: 101,
  wrong: [12, 15, 27, 41, 50, 72],
});

/**
 * 上次交卷的法規 101 年：答錯 8 題（第 15 題選 D），最後 2 題與 3 題一律給分的題目
 * （第 17、26、33 題）沒作答。
 */
export const law101Attempt = mockExamAttempt({
  id: 'attempt-2026-10-18T13:05:00.000Z-law101',
  submittedAt: '2026-10-18T13:05:00.000Z',
  subject: 'law',
  year: 101,
  wrong: [5, 12, 15, 20, 41, 58, 64, 70],
  picks: { 15: 3 },
  blank: [17, 26, 33, 79, 80],
});

/**
 * 構造 113 年：全部答對，只有一律給分的第 23 題沒作答（100 分，結果頁說明「一律給分，
 * 計入答對」）。
 */
const construction113PerfectAttempt = mockExamAttempt({
  id: 'attempt-2026-10-16T10:40:00.000Z-con113',
  submittedAt: '2026-10-16T10:40:00.000Z',
  subject: 'construction',
  year: 113,
  blank: [23],
});

/**
 * 結構 113 年：時間不夠，最後 4 題沒作答，答錯 5 題（結果頁說明「未作答 4 題不給分」；
 * 這份試卷沒有一律給分的題目）。
 */
const structure113BlankAttempt = mockExamAttempt({
  id: 'attempt-2026-10-15T09:20:00.000Z-str113',
  submittedAt: '2026-10-15T09:20:00.000Z',
  subject: 'structure',
  year: 113,
  wrong: [4, 9, 17, 26, 31],
  blank: [37, 38, 39, 40],
});

/** 瀏覽器裡已作答紀錄的模擬考成績。 */
const mockExamAttempts: readonly QuizAttempt[] = [
  law113EarlierAttempt,
  law101EarlierAttempt,
  structure113BlankAttempt,
  construction113PerfectAttempt,
  law101Attempt,
];

/**
 * 模擬考三個畫面共用的存檔（parameters 的 localStorage 與 appState）：
 * - 作答中：法規 101 年（停在第 15 題）、法規 109 年（做了 12 題）。
 * - 已作答紀錄：法規 101 年交過兩次、法規 113 年全部作答、結構 113 年最後 4 題沒作答、
 *   構造 113 年全部答對。
 * - 第 3、12、15、41 題標為難題；第 15 題有用到文字格式的筆記與 2 張圖片。
 */
export const mockExamSavedData = {
  localStorage: mockExamDraftStorage([
    { subject: 'law', year: 101, progress: law101Draft },
    { subject: 'law', year: 109, progress: law109Draft },
  ]),
  appState: {
    ...mockExamAppState(mockExamAttempts),
    difficultQuestionIds: [3, 12, 15, 41].map((number) =>
      mockExamQuestionId('law', 101, number),
    ),
    notes: { 'law-101-15': fixtureNoteContent },
    noteImages: { 'law-101-15': fixtureImages.slice(0, 2) },
  } satisfies Partial<AppState>,
};

/* ------------------------------------------------------------------ */
/* 法規克漏字                                                           */
/* ------------------------------------------------------------------ */

/**
 * 固定的一輪 10 題（全部法規、隨機考點）。前 6 題是設計施工編，接著是目前這題、
 * 無障礙規範（附官方 PDF）、建築法的條文延伸練習題，最後是題庫裡最長的條文
 * （設計施工編第 1 條用語定義，約 3,500 字、6 空）。
 */
const clozeRoundOrder = [
  'daylight',
  'ceiling',
  'fire-area',
  'underground',
  'route',
  'high-lift',
  'travel',
  'a-door-width',
  'b-reissue',
  'd-building-area',
];

function clozeQuestion(id: string): ClozeQuestion {
  const question = clozeBank.questions.find((item) => item.id === id);
  if (!question) throw new Error(`法規克漏字題庫沒有 ${id}`);
  return question;
}

/** 照原文數字的阿拉伯數字寫法填答，例如「五分之一」填「1/5」，全部答對。 */
function clozeRightAnswers(id: string) {
  const question = clozeQuestion(id);
  const answers = question.blanks.map((blank) => blank.answer);
  if (!gradeCloze(question, answers).every(Boolean)) {
    throw new Error(`${id} 的範例答案沒有全對`);
  }
  return answers;
}

/** 全部答對，只有 `wrong` 指定的空格（0 起算）改填錯的數字。 */
function clozeAnswersWithWrong(id: string, wrong: Record<number, string>) {
  const answers = clozeRightAnswers(id).map((answer, index) => wrong[index] ?? answer);
  const grades = gradeCloze(clozeQuestion(id), answers);
  Object.keys(wrong).forEach((index) => {
    if (grades[Number(index)])
      throw new Error(`${id} 第 ${index} 空的錯誤答案被判為正確`);
  });
  return answers;
}

/** 已經做完的題目：提交的答案，或是直接看答案。 */
type ClozeOutcome = readonly string[] | 'revealed';

interface ClozeSessionPlan {
  order: readonly string[];
  /** 目前這題（0 起算）。 */
  index: number;
  /** order 中目前這題之前每題的結果。 */
  done: readonly ClozeOutcome[];
  /** 目前這題空格裡的內容（草稿或已提交的答案）。 */
  answers: readonly string[];
  submitted: boolean;
  version?: string;
}

/**
 * parameters.localStorage：存在 CLOZE_STORAGE_KEY 的一輪克漏字進度（全部法規、隨機考點、
 * 10 題）。頁面讀取時會用 parseClozeSession 檢查，不合格就會重新隨機抽題，所以這裡先檢查
 * 一次，寫錯就直接報錯。
 */
function clozeStorage({
  order,
  index,
  done,
  answers,
  submitted,
  version = clozeBank.version,
}: ClozeSessionPlan) {
  const results: Record<string, string[]> = {};
  const revealed: string[] = [];
  done.forEach((outcome, position) => {
    if (outcome === 'revealed') revealed.push(order[position]);
    else results[order[position]] = [...outcome];
  });
  if (submitted) results[order[index]] = [...answers];
  const session: ClozeSession = {
    version,
    lawId: '全部',
    category: '全部',
    count: 10,
    order: [...order],
    index,
    answers: [...answers],
    submitted,
    results,
    revealed,
  };
  const raw = JSON.stringify(session);
  if (!parseClozeSession(raw)) {
    throw new Error('範例的法規克漏字進度不符合網站的存檔格式');
  }
  return { [CLOZE_STORAGE_KEY]: raw };
}

/**
 * 做到第 7 題（步行至直通樓梯）的一輪：前 6 題有全對、答錯與直接看答案，目前這題剛提交、
 * 第 3 空答錯。
 */
const clozeInProgress: ClozeSessionPlan = {
  order: clozeRoundOrder,
  index: 6,
  done: [
    clozeRightAnswers('daylight'),
    clozeAnswersWithWrong('ceiling', { 2: '1.5' }),
    clozeRightAnswers('fire-area'),
    'revealed',
    clozeRightAnswers('route'),
    clozeAnswersWithWrong('high-lift', { 1: '1000' }),
  ],
  answers: clozeAnswersWithWrong('travel', { 2: '10' }),
  submitted: true,
};

/** parameters.localStorage：做到一半的一輪（clozeInProgress）。 */
export const clozeInProgressStorage = clozeStorage(clozeInProgress);

/** 同一輪，但是在題庫擴充前（1.68 版）開始的。 */
export const clozeBeforeExpansionStorage = clozeStorage({
  ...clozeInProgress,
  version: '1.68-2026-10-14',
});
