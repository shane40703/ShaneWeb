import { defineQuestionMeta } from '@/question-bank/schema';

export default defineQuestionMeta({
  subject: 'law',
  primaryCategory: '建築法',
  topic: '建築管理法規',
  tags: ['建築管理法規'],
  relatedLaws: ['建築物使用類組及變更使用辦法'],
  answerKey: { kind: 'accepted', options: ['D'] },
  provenance: { kind: 'official', page: 2 },
});
