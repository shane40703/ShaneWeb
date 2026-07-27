import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllQuestions } from '@/server/question-bank.server';

const privateUseCharacterPattern = /[\uE000-\uF8FF]/u;
const questionInfoRoot = path.join(process.cwd(), 'QuestionInfo');

describe('question text quality', () => {
  it('contains no unresolved private-use glyphs in source question text', async () => {
    const entries = await readdir(questionInfoRoot, {
      recursive: true,
      withFileTypes: true,
    });
    const sourceFiles = entries.filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith('.txt') || entry.name.endsWith('.json')),
    );

    const sources = await Promise.all(
      sourceFiles.map(async (entry) => ({
        filePath: path.join(entry.parentPath, entry.name),
        content: await readFile(path.join(entry.parentPath, entry.name), 'utf8'),
      })),
    );

    for (const source of sources) {
      expect(
        source.content,
        path.relative(process.cwd(), source.filePath),
      ).not.toMatch(privateUseCharacterPattern);
    }
  });

  it('keeps corrected separators and formula glyphs in the runtime bank', async () => {
    const questions = await loadAllQuestions();
    const separatorQuestion = questions.find(
      (question) => question.id === 'env-114-23',
    );
    const formulaQuestion = questions.find(
      (question) => question.id === 'structure-114-02',
    );

    expect(separatorQuestion?.options).toEqual([
      '市場-油脂截留器',
      '飲食店-油脂截留器',
      '停車場-油水分離器',
      '旅館房間-油水分離器',
    ]);
    expect(formulaQuestion?.options[2]).toBe(
      '常重混凝土的彈性模數 Ec 和 f′c 的平方根成正比',
    );
    questions.forEach((question) => {
      expect(JSON.stringify(question), question.id).not.toMatch(
        privateUseCharacterPattern,
      );
    });
  });
});
