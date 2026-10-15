# Daily paper font

The PDF embeds **Shane Daily Paper Kai Regular**, a glyph-subset derivative of
[LXGW WenKai TC Regular](https://github.com/lxgw/LxgwWenkaiTC), under SIL OFL 1.1.
The original copyright and complete license are in [OFL.txt](OFL.txt).
This open-source Kai-style font approximates the reference exam's typography;
it is not Microsoft's proprietary DFKai-SB font.

Pinned upstream revision: `ddda1877cfd3661fb5be11c493448df992192a8e`.
Original font SHA256: `6662480a3f95b4a90c80b189c679617a48adce3a505118a6af63ce5a482b83fa`.

To rebuild after adding questions or changing PDF labels:

1. Run `npm run generate:question-data`.
2. Install Python `fonttools`, then run `python scripts/prepare-daily-paper-font.py`.
3. Confirm no missing glyphs, inspect generated PDFs, and commit the font/license.

The approximately 2 MB font and PDF engine are loaded only when downloading
a paper, not on initial practice-page load. The engine further subsets the
embedded font for each paper. No serverless PDF service or system font is needed.
