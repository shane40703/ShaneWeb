import { describe, expect, it } from 'vitest';
import { toggleBoldFormatting, toggleTextFormatting } from '@/lib/text-formatting';

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
