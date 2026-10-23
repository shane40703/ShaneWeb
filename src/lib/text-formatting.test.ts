import { describe, expect, it } from 'vitest';
import {
  stripTextFormatting,
  toggleBoldFormatting,
  toggleTextFormatting,
} from '@/lib/text-formatting';

describe('toggleBoldFormatting', () => {
  it('adds bold markers around selected text', () => {
    expect(toggleBoldFormatting('重要法條', 0, 4)).toEqual({
      value: '**重要法條**',
      selectionStart: 2,
      selectionEnd: 6,
    });
  });

  it('removes surrounding bold markers when toggled again', () => {
    expect(toggleBoldFormatting('**重要法條**', 2, 6)).toEqual({
      value: '重要法條',
      selectionStart: 0,
      selectionEnd: 4,
    });
  });

  it('removes bold markers included in the selection', () => {
    expect(toggleBoldFormatting('前文 **重點** 後文', 3, 9)).toEqual({
      value: '前文 重點 後文',
      selectionStart: 3,
      selectionEnd: 5,
    });
  });
});

describe('toggleTextFormatting', () => {
  it.each([
    ['italic', '_文字_'],
    ['superscript', '^文字^'],
    ['subscript', '~文字~'],
    ['red', '!!文字!!'],
  ] as const)('toggles %s markers', (format, marked) => {
    const added = toggleTextFormatting('文字', 0, 2, format);
    expect(added.value).toBe(marked);
    expect(toggleTextFormatting(added.value, added.selectionStart, added.selectionEnd, format).value)
      .toBe('文字');
  });
});

describe('stripTextFormatting', () => {
  it('keeps the text and drops every formatting marker, nested ones included', () => {
    expect(stripTextFormatting('**建築法第 5 條**：集合住宅要 _6 層以上_，!!5 層樓**不**算!!。m^2^ H~2~O'))
      .toBe('建築法第 5 條：集合住宅要 6 層以上，5 層樓不算。m2 H2O');
  });

  it('leaves links and unmatched markers as they are', () => {
    expect(stripTextFormatting('見 https://law.moj.gov.tw/a_b_c 與 2*3')).toBe(
      '見 https://law.moj.gov.tw/a_b_c 與 2*3',
    );
  });
});
