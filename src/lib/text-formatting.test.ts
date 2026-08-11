import { describe, expect, it } from 'vitest';
import { toggleBoldFormatting } from '@/lib/text-formatting';

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
