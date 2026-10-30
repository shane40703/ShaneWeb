// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { publicImageAlt } from './question-bank.server';

describe('publicImageAlt', () => {
  it('keeps the import’s working notes out of what readers see', () => {
    expect(publicImageAlt('第 49 題選項疑似為圖片、PDF 題目區含嵌入圖片附圖')).toBe(
      '第 49 題附圖',
    );
    expect(publicImageAlt('第 38 題題幹文字疑似未完整擷取、題幹引用圖示附圖')).toBe(
      '第 38 題附圖',
    );
    expect(publicImageAlt('第 3 題附圖')).toBe('第 3 題附圖');
  });

  it('leaves a description written by hand alone', () => {
    expect(publicImageAlt('113 年建築結構申論第 2 題附圖')).toBe(
      '113 年建築結構申論第 2 題附圖',
    );
    expect(publicImageAlt('桁架立面圖')).toBe('桁架立面圖');
  });
});
