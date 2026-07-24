export const answerLabels = ['A', 'B', 'C', 'D'] as const;

export type AnswerLabel = (typeof answerLabels)[number];

export const categoryCatalog = {
  law: {
    建築技術規則: ['建築技術規則'],
    建築法: ['建築法', '建築管理法規', '建築師法'],
    都市計畫法: ['都市計畫法', '都市更新法規', '國土與區域計畫', '非都市土地'],
    無障礙設施設計規範: ['無障礙設計'],
    消防法規: ['消防避難'],
    公寓大廈管理條例: ['公寓大廈管理'],
    營造業法: ['營造業法'],
    政府採購法: ['政府採購法'],
    其他營建法規: ['法規位階', '國家公園法', '住宅法', '文化資產保存法', '農舍法規'],
  },
  env: {
    熱: ['熱環境'],
    光: ['照明'],
    聲: ['音環境'],
    空氣: ['通風'],
    設備: ['空調', '給排水', '消防設備', '電氣設備', '垂直運輸'],
    永續: ['綠建築與能源'],
  },
  construction: {
    施工程序: ['混凝土施工', '鋼構施工', '裝修施工', '工地施工'],
    防水工程: ['防水工程', '屋頂防水'],
    構法: [
      '基礎工程',
      '鋼構與複合構造',
      '帷幕牆與外牆',
      '木構造',
      '砌體與隔間',
      '防火與隔音',
    ],
    材料: ['材料', '金屬材料', '混凝土材料', '木質材料', '綠建材'],
    工程管理: ['品質與安全', '進度與成本', 'BIM'],
    永續建築: ['低碳與綠建築', '基地與景觀'],
  },
  structure: {
    力學: ['結構力學', '載重', '材料力學'],
    耐震: ['耐震設計'],
    鋼筋混凝土: ['鋼筋混凝土'],
    結構系統: ['基礎設計', '結構系統'],
    鋼結構: ['鋼結構'],
    木結構: ['木結構'],
    永續設計: ['低碳結構'],
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

export interface PaperMeta {
  status: 'official-partial' | 'official-complete';
  paperCode: string;
  officialName: string;
  totalQuestions: number;
  questionUrl: string;
  answerUrl: string;
  correctionUrl?: string;
}
