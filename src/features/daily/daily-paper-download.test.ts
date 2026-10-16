// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestLocalPaperFonts } from './daily-paper-download';

afterEach(() => vi.unstubAllGlobals());
describe('local paper font access', () => {
  it('uses explicit fallback when unsupported without making network or permission requests', async () => {
    vi.stubGlobal('window', {});
    expect(await requestLocalPaperFonts()).toEqual({});
  });
  it('requests only the two specified font faces and keeps font bytes in memory', async () => {
    const queryLocalFonts = vi.fn().mockResolvedValue([
      { postscriptName: 'TimesNewRomanPSMT', blob: async () => new Blob([new Uint8Array([3, 4])]) },
      { postscriptName: 'PMingLiU', blob: async () => new Blob([new Uint8Array([1, 2])]) },
    ]);
    vi.stubGlobal('window', { queryLocalFonts });
    expect(await requestLocalPaperFonts()).toEqual({ chinese: new Uint8Array([1, 2]), latin: new Uint8Array([3, 4]) });
    expect(queryLocalFonts).toHaveBeenCalledWith({ postscriptNames: ['PMingLiU', 'TimesNewRomanPSMT'] });
  });
  it('falls back on denial instead of preventing the PDF download', async () => {
    vi.stubGlobal('window', { queryLocalFonts: vi.fn().mockRejectedValue(new Error('permission denied')) });
    expect(await requestLocalPaperFonts()).toEqual({});
  });
  it('preserves an available requested face when the other is missing', async () => {
    vi.stubGlobal('window', { queryLocalFonts: vi.fn().mockResolvedValue([
      { postscriptName: 'PMingLiU', blob: async () => new Blob([new Uint8Array([1, 2])]) },
    ]) });
    expect(await requestLocalPaperFonts()).toEqual({ chinese: new Uint8Array([1, 2]), latin: undefined });
  });
});
