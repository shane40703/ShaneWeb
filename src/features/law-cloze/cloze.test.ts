import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLOZE_COUNTS, clozeBank, createClozeSession, getClozeCategories, getClozePool, getFullArticleParts, gradeCloze, normalizeStatutoryAnswer, parseClozeSession, revealClozeAnswer } from './cloze';

describe('statutory cloze answers and source text', () => {
  it('adds four more reviewed statutes with exact fractions, decimals, large amounts and deadline contexts', () => {
    expect(clozeBank.laws).toHaveLength(10);
    const get = (id: string) => clozeBank.questions.find((q) => q.id === id)!;
    for (const lawId of ['condominium-act', 'nonurban-land-rules', 'procurement-act', 'construction-industry-act']) expect(getClozePool({ lawId, category: '全部' }).length).toBeGreaterThanOrEqual(19);
    expect(clozeBank.laws.find((l) => l.id === 'nonurban-land-rules')!.amendedOn).toBe('2026-05-27');
    expect(gradeCloze(get('co-resolution'), ['2/3', '3/4'])).toEqual([true, true]);
    expect(gradeCloze(get('co-resolution'), ['0.6666667', '0.75'])).toEqual([false, false]);
    expect(gradeCloze(get('co-notice'), ['10', '2'])).toEqual([true, true]);
    expect(gradeCloze(get('nu-investment'), ['四億五千萬', '10000000', '1', '15'])).toEqual([true, true, true, true]);
    expect(normalizeStatutoryAnswer('四億五千萬元', '元')).toBe('integer:450000000');
    expect(gradeCloze(get('nu-parcel'), ['0.12', '0.12', '20', '10'])).toEqual([true, true, true, true]);
    expect(gradeCloze(get('nu-small-parcel'), ['12/1000', '10', '4'])).toEqual([false, true, true]);
    expect(get('pr-progress-payment').fullText).toContain('實際工作日，不包括例假日');
    expect(gradeCloze(get('pr-exclusion-graduated'), ['5', '3', '1', '6', '2', '1'])).toEqual(Array(6).fill(true));
    expect(gradeCloze(get('ci-upgrade-a'), ['3', '5', '300000000'])).toEqual([true, true, true]);
    expect(get('co-danger-extension').evidenceKind).toBe('extension');
    expect(get('nu-small-parcel').fullFileUrl).toContain('D0060013');
  });
  it('adds four current statutes focused on durations and distinct penalties, without changing units or fraction notation', () => {
    const coreLaws = ['building-act', 'architects-act', 'urban-planning-act', 'national-land-planning-act'];
    for (const lawId of coreLaws) expect(getClozePool({ lawId, category: '全部' }).length).toBeGreaterThanOrEqual(14);
    expect(clozeBank.laws.find((l) => l.id === 'architects-act')!.amendedOn).toBe('2023-12-06');
    expect(clozeBank.laws.find((l) => l.id === 'national-land-planning-act')!.amendedOn).toBe('2025-01-20');
    const get = (id: string) => clozeBank.questions.find((q) => q.id === id)!;
    expect(gradeCloze(get('b-start'), ['6', '1', '3'])).toEqual([true, true, true]);
    expect(gradeCloze(get('ar-renewal'), ['6', '3'])).toEqual([true, true]);
    expect(gradeCloze(get('ar-suspension'), ['2', '2'])).toEqual([true, true]);
    expect(gradeCloze(get('n-implementation'), ['2', '3', '10'])).toEqual([true, true, true]);
    expect(gradeCloze(get('n-implementation'), ['2', '3', '4'])).toEqual([true, true, false]);
    expect(get('n-implementation').template).toContain('區域計畫法停止適用');
    expect(gradeCloze(get('u-fine'), ['六萬元', '30萬元'])).toEqual([true, true]);
    expect(gradeCloze(get('b-unlicensed-build'), ['50/1000', '千分之五十'])).toEqual([true, true]);
    expect(gradeCloze(get('b-unlicensed-build'), ['5%', '1/20'])).toEqual([false, false]);
    expect(get('n-incompatible-fine').evidenceKind).toBe('extension');
    expect(get('n-unlicensed-fine').blanks.map((b) => b.answer)).toEqual(['300000', '1500000']);
    expect(get('n-controlled-fine').blanks.map((b) => b.answer)).toEqual(['60000', '300000']);
    expect(get('n-fund').blanks.find((b) => b.unit === '億元')!.answer).toBe('500');
    expect(get('ar-suspension').template).toMatch(/^三、/);
  });
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

  it('expands construction coverage with distinct reviewed numeric topics', () => {
    const questions = clozeBank.questions.filter((q) => q.lawId === 'design-construction');
    expect(questions.length).toBeGreaterThanOrEqual(162);
    expect(questions.reduce((n, q) => n + q.blanks.length, 0)).toBeGreaterThanOrEqual(517);
    expect(new Set(questions.map((q) => q.articleNumber + ':' + q.template)).size).toBe(questions.length);
    for (const category of ['用語定義', '基地與容積', '施工安全', '特定建築', '地下建築', '高層建築', '山坡地', '工廠建築', '綠建築']) expect(getClozeCategories('design-construction')).toContain(category);
    expect(clozeBank.questions.filter((q) => q.lawId === 'accessibility')).toHaveLength(39);
  });

  it('preserves decimal ratio/fraction notation without equivalent conversion', () => {
    const shadow = clozeBank.questions.find((q) => q.id === 'd-shadow-height')!;
    expect(gradeCloze(shadow, ['3.6:1'])).toEqual([true]);
    expect(gradeCloze(shadow, ['三‧六比一'])).toEqual([true]);
    expect(gradeCloze(shadow, ['3.6/1'])).toEqual([false]);
    expect(gradeCloze(shadow, ['18:5'])).toEqual([false]);
    const drift = clozeBank.questions.find((q) => q.id === 'd-highrise-drift')!;
    expect(gradeCloze(drift, ['2.5/1000', '10'])).toEqual([true, true]);
    expect(gradeCloze(drift, ['千分之二‧五', '十'])).toEqual([true, true]);
    expect(gradeCloze(drift, ['0.0025', '10'])).toEqual([false, true]);
    expect(gradeCloze(drift, ['25/10000', '10'])).toEqual([false, true]);
    const retaining = clozeBank.questions.find((q) => q.id === 'd-slope-retaining')!;
    expect(gradeCloze(retaining, ['1.5', '6', '1:1.5'])).toEqual([true, true, true]);
    expect(gradeCloze(retaining, ['1.5', '6', '2:3'])).toEqual([true, true, false]);
    expect(normalizeStatutoryAnswer('1/Infinity')).toBeNull();
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
    expect(clozeBank.questions.find((q) => q.id === 'd-building-area')!.template).toContain('三、建築面積');
    expect(clozeBank.questions.find((q) => q.id === 'd-general-lift')!.template).toContain('一、{{0}}層以上');
    expect(clozeBank.questions.find((q) => q.id === 'd-emergency-opening')!.template).toContain('第{{1}}層以下');
    expect(clozeBank.questions.find((q) => q.id === 'd-detention')!.template).toContain('{{1}}（立方公尺／平方公尺）');
    for (const q of clozeBank.questions) {
      for (const line of q.template.split('\n')) {
        expect(line).not.toMatch(/^\{\{\d+\}\}[、）)]/);
        if (q.lawId === 'accessibility') expect(line).not.toMatch(/^\{\{\d+\}\}\./);
        expect(line).not.toMatch(/第\{\{\d+\}\}(條|款|項|目|章|節)/);
      }
    }
  });

  it('validates all excerpts, answer ranges and full text against reviewed official sources', () => {
    const source = JSON.parse(readFileSync('ref/law-cloze/design-construction-snapshot.json', 'utf8')) as { articles: Array<{ number: string; text: string }> };
    const supplements = JSON.parse(readFileSync('ref/law-cloze/article-supplements.json', 'utf8')) as Record<string, { text: string }>;
    const provisions = JSON.parse(readFileSync('ref/law-cloze/accessibility-provisions.json', 'utf8')) as Array<{ number: string; text: string }>;
    const tables = JSON.parse(readFileSync('ref/law-cloze/accessibility-supplements.json', 'utf8')) as Record<string, { rawTable: string; text: string }>;
    const core = [...JSON.parse(readFileSync('ref/law-cloze/core-laws-snapshot.json', 'utf8')), ...JSON.parse(readFileSync('ref/law-cloze/additional-laws-snapshot.json', 'utf8'))] as Array<{ id: string; articles: Array<{ number: string; text: string }> }>;
    expect(source.articles).toHaveLength(389);
    expect(new Set(clozeBank.questions.map((q) => q.id)).size).toBe(clozeBank.questions.length);
    const evidencePaths = new Set<string>();
    for (const q of clozeBank.questions) {
      const expectedText = q.lawId === 'design-construction'
        ? source.articles.find((a) => a.number === q.articleNumber)!.text + (supplements[q.articleNumber] ? '\n\n' + supplements[q.articleNumber].text : '')
        : q.lawId !== 'accessibility' ? core.find((law) => law.id === q.lawId)!.articles.find((a) => a.number === q.articleNumber)!.text
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
      for (const part of getFullArticleParts(q).filter((p) => p.isAnswer)) expect(part.text).toBe(q.blanks[part.blankIndex!].original);
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
  it('preserves 1.68 wrong answers, drafts and reading status without inserting 1.69 questions', () => {
    const session = createClozeSession({ count: 5 });
    session.version = '1.68-2026-10-14';
    session.order = ['daylight', 'ar-suspension', 'b-start', 'u-fine', 'n-fund'];
    session.index = 1;
    session.answers = ['99', ''];
    session.results = { daylight: ['1/5', '0.125', '75'] };
    session.revealed = ['ar-suspension'];
    expect(parseClozeSession(JSON.stringify(session))).toEqual(session);
    expect(parseClozeSession(JSON.stringify({ ...session, order: ['daylight', 'co-resolution', ...session.order.slice(2)] }))).toBeNull();
    const restored = parseClozeSession(JSON.stringify(session))!;
    expect(gradeCloze(clozeBank.questions.find((q) => q.id === 'daylight')!, restored.results.daylight)).toEqual([true, false, true]);
  });
  it('reveals answers without fabricating scores, keeps drafts, and rejects corrupt reading progress', () => {
    const session = createClozeSession({ count: 5 });
    const q = clozeBank.questions.find((q) => q.id === session.order[0])!;
    session.answers = q.blanks.map(() => '');
    session.answers[0] = '123';
    const reading = revealClozeAnswer(session);
    expect(reading.answers).toEqual(session.answers);
    expect(reading.results).toEqual({});
    expect(reading.submitted).toBe(false);
    expect(reading.revealed).toEqual([q.id]);
    expect(revealClozeAnswer(reading)).toBe(reading);
    expect(parseClozeSession(JSON.stringify(reading))).toEqual(reading);
    const next = { ...reading, index: 1, answers: [] };
    expect(parseClozeSession(JSON.stringify(next))).toEqual(next);
    for (const invalid of [{ revealed: [q.id, q.id] }, { revealed: [session.order[4]] }, { revealed: null }, { revealed: [1] }, { results: { [q.id]: q.blanks.map((b) => b.answer) } }]) expect(parseClozeSession(JSON.stringify({ ...reading, ...invalid }))).toBeNull();
    const submitted = { ...session, submitted: true, answers: q.blanks.map((b) => b.answer), results: { [q.id]: q.blanks.map((b) => b.answer) } };
    expect(revealClozeAnswer(submitted)).toBe(submitted);
    const oldWithoutReading = { ...session } as Partial<typeof session>;
    delete oldWithoutReading.revealed;
    expect(parseClozeSession(JSON.stringify(oldWithoutReading))).toEqual(session);
  });

  it('restores both 1.67 banks without inserting new laws into saved rounds', () => {
    const old = createClozeSession({ count: 30 });
    old.version = '1.67-expanded-2026-10-12';
    old.order = clozeBank.compatibleVersions.find((v) => v.version === old.version)!.questionIds.slice(0, 30);
    delete (old as Partial<typeof old>).revealed;
    expect(parseClozeSession(JSON.stringify(old))).toEqual({ ...old, revealed: [] });
    expect(parseClozeSession(JSON.stringify({ ...old, order: ['b-review', ...old.order.slice(1)] }))).toBeNull();
  });

  it('supports every requested count with unique random questions from the selected law', () => {
    for (const lawId of ['全部', ...clozeBank.laws.map((law) => law.id)]) {
      for (const count of CLOZE_COUNTS) {
        const session = createClozeSession({ lawId, count });
        const expectedCount = Math.min(count, getClozePool(session).length);
        expect(session.order).toHaveLength(expectedCount);
        expect(new Set(session.order).size).toBe(expectedCount);
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

  it('preserves the previous capped round when the question bank expands', () => {
    const old = createClozeSession({ lawId: 'design-construction', category: '地下建築', count: 30 });
    old.version = clozeBank.legacyVersion;
    old.order = ['underground', 'underground-stair'];
    old.answers = ['6', '', '3'];
    expect(parseClozeSession(JSON.stringify(old))).toEqual(old);
    old.answers = ['6', '1:12', '3'];
    old.submitted = true;
    old.results.underground = [...old.answers];
    expect(parseClozeSession(JSON.stringify(old))).toEqual(old);
    expect(gradeCloze(clozeBank.questions.find((q) => q.id === 'underground')!, old.answers)).toEqual([true, true, true]);
    const fresh = createClozeSession({ lawId: old.lawId, category: old.category, count: old.count });
    expect(fresh.version).toBe(clozeBank.version);
    expect(fresh.order.length).toBeGreaterThan(2);
    expect(fresh.order.some((id) => id.startsWith('d-'))).toBe(true);
    expect(parseClozeSession(JSON.stringify({ ...old, order: fresh.order }))).toBeNull();
    expect(parseClozeSession(JSON.stringify({ ...fresh, order: old.order }))).toBeNull();
  });
});
