# Daily paper fonts

The preferred faces are the user's **PMingLiU (新細明體)** and **Times New Roman**.
On supported desktop browsers, a click requests Local Font Access for exactly
`PMingLiU` and `TimesNewRomanPSMT`. Permission is optional. Font bytes remain in
memory and are embedded only in the downloaded PDF, never uploaded, cached in
local storage, or redistributed as website assets. Restricted, preview-only,
bitmap-only and no-subsetting fonts fall back to the open fonts below.

If either requested face is unavailable, the interface and PDF answer-page
footnote explicitly identify the replacement:

- **Shane Daily Paper Ming Regular**, an offline subset/TrueType derivative of
  [Noto Serif CJK TC](https://github.com/notofonts/noto-cjk), SIL OFL 1.1.
  Revision: `f8d157532fbfaeda587e826d4cd5b21a49186f7c`.
  Original SHA256: `234301038e76e7c35c43113785024700c4e4fe7bdce1d1fbbc42fca7e6683798`.
  Full license: [OFL.txt](OFL.txt); original copyright remains in font metadata.
- **Tinos Regular**, a Times-style open font under SIL OFL 1.1.
  [Google Fonts source](https://github.com/google/fonts/tree/ba95515f1333efe9342c2ad988b9c2f6bef6dbad/ofl/tinos),
  upstream [Tinos project](https://github.com/googlefonts/tinos).
  Original SHA256: `60a0e8ef0c04dd5dd69ffe91025fa2ae5836cbd35600a82ba031977557e2cb61`.
  Full license: [OFL-Tinos.txt](OFL-Tinos.txt).
- The standard PDF Symbol face covers mathematical characters unavailable in
  either open font, without changing their Unicode values.

The fallback fonts are not mislabeled as Microsoft's proprietary fonts.
See [Microsoft's font redistribution and document embedding FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq)
and [Chrome's Local Font Access documentation](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts).

## Rebuild and verify

1. Run `npm run generate:question-data`.
2. Install Python `fonttools`, then run `python scripts/prepare-daily-paper-font.py`.
3. Confirm source hashes and zero missing glyphs. Run the paper tests
   (`npx vitest run src/features/daily`) and the 選擇題練習 paper download in
   `e2e/practice.spec.ts`, then inspect the downloaded PDF's first and last pages.
4. Optionally run `npx tsx scripts/generate-daily-paper-font-proof.ts` to compare
   locally installed requested fonts with open fallbacks, without publishing them.

The PDF engine and approximately 3.4 MB of open fonts load only on download.
Fallback fonts are subset offline and embedded without re-subsetting for
reader compatibility. Local editable/installable fonts are subset per document.
