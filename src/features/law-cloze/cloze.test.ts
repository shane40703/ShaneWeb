import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clozeBank, createClozeSession, gradeCloze, normalizeStatutoryAnswer, parseClozeSession } from './cloze';

describe('statutory cloze answers', () => {
  it('requires the statute notation rather than mathematically equivalent values', () => {
    const daylight = clozeBank.questions.find((q) => q.id === 'daylight')!;
    expect(gradeCloze(daylight, ['1/5', '八分之一', '７５'])).toEqual([true, true, true]);
    expect(gradeCloze(daylight, ['0.2', '0.125', '75'])).toEqual([false, false, true]);
    expect(gradeCloze(daylight, ['20%', '2/16', '0.75公尺'])).toEqual([false, false, false]);
    const slope = clozeBank.questions.find((q) => q.id === 'slope-step')!;
    expect(gradeCloze(slope, ['3', '1.2', '一比八'])).toEqual([true, true, true]);
    expect(gradeCloze(slope, ['3', '1.2', '1/8'])).toEqual([true, true, false]);
    expect(normalizeStatutoryAnswer('半小時', '小時')).not.toEqual(normalizeStatutoryAnswer('0.5', '小時'));
  });

  it('does not accept blank, invalid or converted-unit answers', () => {
    for (const input of ['', 'Infinity', 'NaN', '1e3', '1+1', '1/0', 'abc']) {
      expect(normalizeStatutoryAnswer(input)).toBeNull();
    }
    expect(normalizeStatutoryAnswer('一千五百', '平方公尺')).toBe('integer:1500');
    expect(normalizeStatutoryAnswer('1,500', '平方公尺')).toBe('integer:1500');
  });

  it('checks every published answer and excerpt against the captured official text', () => {
    const source = JSON.parse(readFileSync('ref/law-cloze/design-construction-snapshot.json', 'utf8')) as { articles: Array<{ number: string; text: string }> };
    const supplements = JSON.parse(readFileSync('ref/law-cloze/article-supplements.json', 'utf8')) as Record<string, { text: string }>;
    expect(source.articles).toHaveLength(389);
    expect(clozeBank.questions.find((q) => q.id === 'fire-area')!.template).not.toContain('一、五○○');
    for (const q of clozeBank.questions) {
      const article = source.articles.find((a) => a.number === q.articleNumber)!;
      expect(q.fullText).toBe(article.text + (supplements[q.articleNumber] ? '\n\n' + supplements[q.articleNumber].text : ''));
      expect(q.articleNumber).not.toBe('301');
      expect(q.evidence.length).toBeGreaterThan(0);
      expect(gradeCloze(q, q.blanks.map((b) => b.answer))).toEqual(q.blanks.map(() => true));
      const restored = q.template.replace(/\{\{(\d+)\}\}(小時|人|輛)?/g, (_match, index: string, unit: string | undefined) => {
        const original = q.blanks[Number(index)].original;
        return original + (unit && !original.endsWith(unit) ? unit : '');
      });
      for (const line of restored.split('\n')) expect(article.text.split('\n')).toContain(line);
    }
  });

  it('restores a submitted question without losing answers or re-counting results', () => {
    const session = createClozeSession('一般設計', () => .5);
    const q = clozeBank.questions.find((item) => item.id === session.order[0])!;
    session.answers = q.blanks.map((blank) => blank.answer);
    session.submitted = true;
    session.results[q.id] = session.answers;
    expect(parseClozeSession(JSON.stringify(session))).toEqual(session);
    expect(parseClozeSession(JSON.stringify({ ...session, version: 'old' }))).toBeNull();
    expect(parseClozeSession(JSON.stringify({ ...session, order: ['missing'] }))).toBeNull();
    expect(parseClozeSession(JSON.stringify({ ...session, answers: [] }))).toBeNull();
  });
});
