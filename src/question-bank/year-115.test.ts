import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MISSING_QUESTION_IMAGE_NOTICE } from '@/lib/question-completeness';
import { loadSubjectQuestions } from '@/server/question-bank.server';
import { resolvePracticePool, DEFAULT_PRACTICE_SETTINGS } from '@/features/practice/practice-session';

describe('115 exam import', () => {
  const papers = [
    { subject: 'law', source: 'regulations', count: 80, written: 0, imageCount: 0 },
    { subject: 'construction', source: 'construction', count: 80, written: 0, imageCount: 10 },
    { subject: 'env', source: 'environment', count: 40, written: 2, imageCount: 2 },
    { subject: 'structure', source: 'structure', count: 40, written: 2, imageCount: 15 },
  ] as const;
  for (const { subject, source, count, written, imageCount } of papers) {
    it(`loads ${subject} questions, supplied answer keys, and image status`, async () => {
      const bank = await loadSubjectQuestions(subject, 115);
      const choices = bank.filter((q) => q.format !== 'written');
      expect(choices).toHaveLength(count);
      expect(bank.filter((q) => q.format === 'written')).toHaveLength(written);
      if (subject === 'structure') {
        const essay = bank.find((q) => q.format === 'written' && q.questionNumber === 2);
        expect(essay?.content.some((item) => item.kind === 'image')).toBe(true);
        expect(essay?.text).not.toContain(MISSING_QUESTION_IMAGE_NOTICE);
      }
      expect(choices.filter((q) => q.text.includes(MISSING_QUESTION_IMAGE_NOTICE))).toHaveLength(0);
      expect(choices.filter((q) => q.content.some((item) => item.kind === 'image'))).toHaveLength(imageCount);
      const answers = (await readFile(path.join(process.cwd(), 'AnswersInfo', source, '115.txt'), 'utf8')).trim().split(/\r?\n/);
      expect(answers).toHaveLength(count);
      for (const question of choices) {
        expect(question.options).toHaveLength(4);
        expect(question.options.every((option) => option.trim())).toBe(true);
        expect(question.answerKey).toEqual({ kind: 'accepted', options: ['ABCD'.indexOf(answers[question.questionNumber - 1].split('=')[1])] });
      }
      const pool = resolvePracticePool(bank, subject, DEFAULT_PRACTICE_SETTINGS);
      expect(pool.candidates).toHaveLength(count);
    });
  }
});
