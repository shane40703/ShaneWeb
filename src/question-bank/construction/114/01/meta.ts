import { defineQuestionMeta } from '@/question-bank/schema';
import question02 from './question-02.jpg';

export default defineQuestionMeta({
  subject: 'construction',
  primaryCategory: '材料',
  topic: '金屬材料',
  tags: ['金屬材料'],
  answerKey: { kind: 'accepted', options: ['B'] },
  provenance: { kind: 'official', page: 1 },
  images: {
    'question-02.jpg': {
      src: question02,
      alt: '標示為（1）、（2）、（3）的三個衝擊韌性試片斷口照片',
    },
  },
});
