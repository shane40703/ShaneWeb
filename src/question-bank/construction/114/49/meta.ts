import { defineQuestionMeta } from '@/question-bank/schema';
import question02 from './question-02.png';

export default defineQuestionMeta({
  subject: 'construction',
  primaryCategory: '防水工程',
  topic: '屋頂防水',
  tags: ['防水工程'],
  answerKey: { kind: 'accepted', options: ['A', 'B'] },
  provenance: { kind: 'official', page: 7 },
  images: {
    'question-02.png': {
      src: question02,
      alt: '圖 A 至圖 D 四種屋頂設備基礎防水收頭細部剖面圖',
    },
  },
});
