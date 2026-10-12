import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLOZE_COUNTS, clozeBank, createClozeSession, getClozeCategories, getClozePool, getFullArticleParts, gradeCloze, normalizeStatutoryAnswer, parseClozeSession } from './cloze';

describe('statutory cloze answers and source text', () => {
  it('requires statute notation rather than mathematically equivalent values', () => {
    const daylight = clozeBank.questions.find((q) => q.id === 'daylight')!;
    expect(gradeCloze(daylight, ['1/5', '八分之一', '７５'])).toEqual([true, true, true]);
    expect(gradeCloze(daylight, ['0.2', '0.125', '75'])).toEqual([false, false, true]);
    expect(gradeCloze(daylight, ['20%', '2/16', '0.75公尺'])).toEqual([false, false, false]);
    const slope = clozeBank.questions.find((q) => q.id === 'slope-step')!;
    expect(gradeCloze(slope, ['3', '1.2', '一比八'])).toEqual([true, true, true]);
    expect(gradeCloze(slope, ['3', '1.2', '1/8'])).toEqual([true, true, false]);
    expect(normalizeStatutoryAnswer('半小時', '小時')).not.toEqual(normalizeStatutoryAnswer('0.5', '小時'));
    const ramp = clozeBank.questions.find((q) => q.id === 'a-ramp-slope')!;
    expect(gradeCloze(ramp, ['1/12', '1/10', '1/5'])).toEqual([true, true, true]);
    expect(gradeCloze(ramp, ['1:12', '0.1', '20%'])).toEqual([false, false, false]);
  });

  it('rejects blank, invalid and converted-unit answers', () => {
    for (const input of ['', 'Infinity', 'NaN', '1e3', '1+1', '1/0', 'abc']) expect(normalizeStatutoryAnswer(input)).toBeNull();
    expect(normalizeStatutoryAnswer('一千五百', '平方公尺')).toBe('integer:1500');
    expect(normalizeStatutoryAnswer('1,500', '平方公尺')).toBe('integer:1500');
  });

  it('keeps clause numbers, provision numbers and non-numeric wording intact', () => {
    const underground = clozeBank.questions.find((q) => q.id === 'underground')!;
    expect(underground.template).toContain('三、地下通道及地下廣場之天花板淨高不得小於{{2}}公尺');
    expect(underground.template).not.toContain('淨高不得小於三公尺');
    expect(clozeBank.questions.find((q) => q.id === 'sunlight')!.template).toContain('情形之一者');
    expect(clozeBank.questions.find((q) => q.id === 'fire-area')!.template).not.toContain('一、五○○');
    expect(clozeBank.questions.find((q) => q.id === 'a-tolerance')!.template).toContain('﹙如3公分至5公分﹚');
    expect(clozeBank.questions.find((q) => q.id === 'a-car')!.template).not.toContain('600公分');
    expect(clozeBank.questions.find((q) => q.id === 'shelter')!.template).not.toContain('二百四十平方公尺');
    expect(clozeBank.questions.find((q) => q.id === 'a-stair-step')!.template).toContain('304.1級高及級深');
    for (const q of clozeBank.questions) {
      for (const line of q.template.split('\n')) {
        expect(line).not.toMatch(/^\{\{\d+\}\}[、）)]/);
        if (q.lawId === 'accessibility') expect(line).not.toMatch(/^\{\{\d+\}\}\./);
      }
    }
  });

  it('validates all excerpts, answer ranges and full text against reviewed official sources', () => {
    const source = JSON.parse(readFileSync('ref/law-cloze/design-construction-snapshot.json', 'utf8')) as { articles: Array<{ number: string; text: string }> };
    const supplements = JSON.parse(readFileSync('ref/law-cloze/article-supplements.json', 'utf8')) as Record<string, { text: string }>;
    const provisions = JSON.parse(readFileSync('ref/law-cloze/accessibility-provisions.json', 'utf8')) as Array<{ number: string; text: string }>;
    const tables = JSON.parse(readFileSync('ref/law-cloze/accessibility-supplements.json', 'utf8')) as Record<string, { rawTable: string; text: string }>;
    expect(source.articles).toHaveLength(389);
    expect(new Set(clozeBank.questions.map((q) => q.id)).size).toBe(clozeBank.questions.length);
    const evidencePaths = new Set<string>();
    for (const q of clozeBank.questions) {
      const expectedText = q.lawId === 'design-construction'
        ? source.articles.find((a) => a.number === q.articleNumber)!.text + (supplements[q.articleNumber] ? '\n\n' + supplements[q.articleNumber].text : '')
        : q.articleNumber.split('、').map((code) => {
          const text = provisions.find((p) => p.number === code)!.text;
          return tables[code] ? text.replace(tables[code].rawTable, tables[code].text) : text;
        }).join('\n');
      expect(q.fullText, q.id).toBe(expectedText);
      if (q.lawId === 'design-construction') expect(q.articleNumber).not.toBe('301');
      expect(q.evidence.length).toBeGreaterThan(0);
      expect(gradeCloze(q, q.blanks.map((b) => b.answer)), q.id).toEqual(q.blanks.map(() => true));
      const restored = q.template.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => q.blanks[Number(index)].original);
      for (const line of restored.split('\n')) expect(expectedText.split('\n'), q.id).toContain(line);
      expect(getFullArticleParts(q).map((part) => part.text).join('')).toBe(q.fullText);
      expect(new Set(q.answerRanges.map((r) => r.blankIndex)).size).toBe(q.blanks.length);
      let end = 0;
      for (const range of q.answerRanges) {
        expect(range.start).toBeGreaterThanOrEqual(end);
        expect(q.fullText.slice(range.start, range.end)).toBe(q.blanks[range.blankIndex].original);
        end = range.end;
      }
      q.evidence.forEach((e) => evidencePaths.add(`public/question-bank/法規/${e.year}/${String(e.number).padStart(2, '0')}/meta.json`));
    }
    for (const path of evidencePaths) expect(existsSync(path), path).toBe(true);
    const ramp = clozeBank.questions.find((q) => q.id === 'a-ramp-slope')!;
    expect(ramp.fullText).toContain('高差：超過5公分未達20公分者；坡度：1/10');
    expect(ramp.fullText).toContain('高差：超過3公分未達5公分者；坡度：1/5');
    const stair = clozeBank.questions.find((q) => q.id === 'a-stair-step')!;
    expect(stair.blanks.slice(0, 2).map((b) => b.original)).toEqual(['16', '26']);
    expect(clozeBank.laws.find((law) => law.id === 'accessibility')!.correctedOn).toBe('2020-05-11');
    expect(clozeBank.questions.filter((q) => q.lawId === 'accessibility').some((q) => q.articleNumber.startsWith('A'))).toBe(false);
  });
});

describe('cloze exam selection and restoration', () => {
  it('supports every requested count with unique random questions from the selected law', () => {
    for (const lawId of ['全部', ...clozeBank.laws.map((law) => law.id)]) {
      for (const count of CLOZE_COUNTS) {
        const session = createClozeSession({ lawId, count });
        expect(session.order).toHaveLength(count);
        expect(new Set(session.order).size).toBe(count);
        expect(session.order.every((id) => getClozePool(session).some((q) => q.id === id))).toBe(true);
        expect(parseClozeSession(JSON.stringify(session))).toEqual(session);
      }
    }
    expect(createClozeSession({}, () => .1).order).not.toEqual(createClozeSession({}, () => .9).order);
  });

  it('filters categories per law and caps small pools without duplicate questions', () => {
    expect(getClozeCategories('accessibility')).not.toContain('防火區劃');
    const session = createClozeSession({ lawId: 'accessibility', category: '無障礙客房', count: 30 });
    expect(session.order).toEqual(['a-room']);
    expect(session.count).toBe(30);
    expect(parseClozeSession(JSON.stringify(session))).toEqual(session);
    expect(() => createClozeSession({ lawId: 'accessibility', category: '防火區劃' })).toThrow();
    expect(() => createClozeSession({ count: 4 })).toThrow();
  });

  it('restores drafts/results and rejects corrupt, stale and out-of-pool sessions', () => {
    const session = createClozeSession({ lawId: 'design-construction', category: '一般設計', count: 5 }, () => .5);
    const q = clozeBank.questions.find((item) => item.id === session.order[0])!;
    session.answers = q.blanks.map((blank) => blank.answer);
    session.submitted = true;
    session.results[q.id] = session.answers;
    expect(parseClozeSession(JSON.stringify(session))).toEqual(session);
    for (const invalid of [{ version: 'old' }, { order: ['missing'] }, { answers: [] }, { count: 0 }, { index: 99 }, { lawId: 'missing' }, { category: '樓梯' }, { results: {} }, { order: Array(5).fill(q.id) }]) {
      expect(parseClozeSession(JSON.stringify({ ...session, ...invalid }))).toBeNull();
    }
    const draft = { ...session, results: {}, submitted: false, answers: q.blanks.map(() => '') };
    draft.answers[draft.answers.length - 1] = '75';
    expect(parseClozeSession(JSON.stringify(draft))).toEqual(draft);
    expect(parseClozeSession(JSON.stringify({ ...draft, answers: [null] }))).toBeNull();
    expect(parseClozeSession(JSON.stringify({ ...draft, index: 1 }))).toBeNull();
  });
});
