import type { StaticImageData } from 'next/image';

export const answerLabels = ['A', 'B', 'C', 'D'] as const;

export type AnswerLabel = (typeof answerLabels)[number];

export const categoryCatalog = {
  law: {
    建築技術規則: ['建築技術規則'],
    建築法: ['建築法'],
    都市計畫法: ['都市計畫法'],
    無障礙設施設計規範: ['無障礙設計'],
    消防法規: ['消防避難'],
  },
  env: {
    熱: ['熱環境'],
    光: ['照明'],
    聲: ['音環境'],
    空氣: ['通風'],
    設備: ['空調'],
  },
  construction: {
    施工程序: ['混凝土施工', '鋼構施工'],
    防水工程: ['防水工程', '屋頂防水'],
    構法: ['基礎工程'],
    材料: ['材料', '金屬材料'],
  },
  structure: {
    力學: ['結構力學', '載重'],
    耐震: ['耐震設計'],
    鋼筋混凝土: ['鋼筋混凝土'],
    結構系統: ['基礎設計'],
  },
} as const;

export type SubjectId = keyof typeof categoryCatalog;

type CategoryMap<S extends SubjectId> = (typeof categoryCatalog)[S];

export type PrimaryCategory<S extends SubjectId> = keyof CategoryMap<S> & string;

export type Topic<S extends SubjectId> = CategoryMap<S>[keyof CategoryMap<S>] extends readonly (
  infer T
)[]
  ? T & string
  : never;

type TopicForCategory<
  S extends SubjectId,
  C extends PrimaryCategory<S>,
> = C extends keyof CategoryMap<S>
  ? CategoryMap<S>[C] extends readonly (infer T)[]
    ? T & string
    : never
  : never;

export type SourceAnswerKey =
  | {
      kind: 'accepted';
      options: readonly [AnswerLabel, ...AnswerLabel[]];
    }
  | {
      kind: 'all-credit';
    };

export type QuestionProvenance =
  | { kind: 'sample' }
  | { kind: 'official'; page: number };

export interface QuestionMeta<
  S extends SubjectId = SubjectId,
  C extends PrimaryCategory<S> = PrimaryCategory<S>,
> {
  subject: S;
  primaryCategory: C;
  topic: TopicForCategory<S, C>;
  tags: readonly Topic<S>[];
  relatedLaws?: readonly string[];
  answerKey: SourceAnswerKey;
  provenance: QuestionProvenance;
  images?: Readonly<Record<string, { src: StaticImageData; alt: string }>>;
}

export function defineQuestionMeta<
  const S extends SubjectId,
  const C extends PrimaryCategory<S>,
>(meta: QuestionMeta<S, C>) {
  return meta;
}

export interface PaperMeta {
  status: 'official-partial' | 'official-complete';
  paperCode: string;
  officialName: string;
  totalQuestions: number;
  questionUrl: string;
  answerUrl: string;
  correctionUrl?: string;
}

export function definePaper(meta: PaperMeta) {
  return meta;
}
