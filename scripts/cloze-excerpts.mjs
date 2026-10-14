// Mask reviewed numeric tokens, never enumeration prefixes, headings or citations.
const numericChar = /[\d零〇○一二兩三四五六七八九十百千萬億點.．‧比/:]/;
export function maskReviewedExcerpts(selected, definitions, fullText) {
  const ranges = [];
  const blanks = definitions.map(([prefix, target, answer, label, unit], index) => {
    if (!selected.some((item) => item.prefix === prefix)) throw new Error('Excerpt missing: ' + prefix);
    const numeral = target.replace(/(小時|人|輛)$/, '');
    // Repeated numeric thresholds in other excerpts share the blank unless
    // another reviewed definition explicitly owns that numeral/unit there.
    const sharedDefinition = definitions.filter((d) => d[1].replace(/(小時|人|輛)$/, '') === numeral && d[4] === unit).length > 1;
    const candidates = sharedDefinition ? selected.filter((line) => line.prefix === prefix) : selected;
    let found = 0;
    for (const line of candidates) {
      const structural = line.text.match(/^(?:[一二三四五六七八九十百]+、|[（(][一二三四五六七八九十百]+[）)]|A?\d{3,4}(?:\.\d+)*(?:\s|(?=[\u4e00-\u9fff])))/)?.[0].length ?? 0;
      const articleStart = fullText.indexOf(line.text);
      if (articleStart < 0 || fullText.indexOf(line.text, articleStart + 1) >= 0) throw new Error('Ambiguous source line: ' + prefix);
      let offset = line.text.indexOf(numeral);
      while (offset >= 0) {
        const before = line.text[offset - 1] ?? '';
        const after = line.text[offset + numeral.length] ?? '';
        // 百分之 is a unit prefix, not part of the integer blank.
        const percentPrefix = unit === '%' && line.text.slice(0, offset).endsWith('百分之');
        const partialFraction = line.text.slice(0, offset).endsWith('分之') || line.text.slice(offset + numeral.length).startsWith('分之');
        const partialGroup = /[、,]/.test(after) && numericChar.test(line.text[offset + numeral.length + 1] ?? '') || offset > structural && /[、,]/.test(before) && numericChar.test(line.text[offset - 2] ?? '');
        const unitMatches = !unit || ['比例', '比值'].includes(unit)
          || (unit === '%' ? percentPrefix || after === '%' : line.text.slice(offset + numeral.length).replace(/^[（(]/, '').startsWith(unit.split(/[／/]/)[0]));
        const citation = before === '第' && /^(條|款|項|目|章|節)/.test(line.text.slice(offset + numeral.length));
        const numericUnit = unit && !['%', '比例', '比值'].includes(unit) && unitMatches && numericChar.test(unit[0]);
        if (offset >= structural && (!numericChar.test(before) || percentPrefix) && (!numericChar.test(after) || numericUnit) && !citation && !partialGroup && unitMatches && (!partialFraction || percentPrefix)) {
          ranges.push({ prefix: line.prefix, start: offset, end: offset + numeral.length, blankIndex: index, articleStart });
          if (line.prefix === prefix) found++;
        }
        offset = line.text.indexOf(numeral, offset + numeral.length);
      }
    }
    if (!found) throw new Error('Numeric token missing (or structural): ' + prefix + ' / ' + numeral);
    return { answer: numeral === '半' ? '半' : unit === '比值' ? answer.replace('/', ':') : answer, label, unit, original: numeral };
  });
  const template = selected.map((line) => {
    const masks = ranges.filter((r) => r.prefix === line.prefix).sort((a, b) => a.start - b.start);
    let end = 0;
    let result = '';
    for (const mask of masks) {
      if (mask.start < end) throw new Error('Overlapping numeric masks: ' + line.prefix);
      result += line.text.slice(end, mask.start) + '{{' + mask.blankIndex + '}}';
      end = mask.end;
    }
    return result + line.text.slice(end);
  }).join('\n');
  const answerRanges = ranges.map(({ start, end, blankIndex, articleStart }) => ({ start: start + articleStart, end: end + articleStart, blankIndex })).sort((a, b) => a.start - b.start);
  return { template, blanks, answerRanges };
}
