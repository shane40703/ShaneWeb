import type { Subject } from '@/lib/types';
import type { SubjectId } from '@/question-bank/schema';

export const subjects = [
  {
    id: 'law',
    directory: '法規',
    name: '建築法規與實務',
    shortName: '法規',
    description: '建築法規、都市計畫、建築管理與實務應用',
  },
  {
    id: 'env',
    directory: '環控',
    name: '建築環境控制',
    shortName: '環控',
    description: '環境物理、熱濕空氣、光環境、音環境與設備',
  },
  {
    id: 'construction',
    directory: '構造',
    name: '建築構造與施工',
    shortName: '構造',
    description: '建築材料、構造原理、施工技術與工程管理',
  },
  {
    id: 'structure',
    directory: '結構',
    name: '建築結構',
    shortName: '結構',
    description: '結構力學、鋼筋混凝土、鋼結構與基礎工程',
  },
] as const satisfies readonly Subject[];

const subjectIds = subjects.map((subject) => subject.id);
subjectIds satisfies readonly SubjectId[];

export const years = Array.from({ length: 13 }, (_, index) => 114 - index);

export function getSubject(subjectId: string) {
  return subjects.find((subject) => subject.id === subjectId);
}
