"""Optional PDF QA: pip install pymupdf; run after e2e/daily-paper.spec.ts.

Checks actual downloaded PDFs against the assigned questions and shuffled keys;
renders first/last pages and contact sheets for visual inspection.
"""
import json
import re
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'test-results'
OUTPUT = RESULTS / 'daily-paper-qa'
OUTPUT.mkdir(parents=True, exist_ok=True)
count = 0
for file in sorted(RESULTS.glob('*-desktop/*.pdf')):
    subject = file.stem
    if subject not in ['law', 'env', 'construction', 'structure']:
        continue
    pool = []
    for year in [114, 113, 112]:
        pool.extend(q for q in json.loads((ROOT / 'public' / 'question-data' / subject / f'{year}.json').read_text(encoding='utf-8')) if q['answerKey']['kind'] == 'accepted' and len(q['answerKey']['options']) < len(q['options']))
    questions = pool[:50]
    pdf = pymupdf.open(file)
    assert pdf.metadata['title'] == '專門職業及技術人員高等考試建築師每日練習試題'
    assert len(pdf) > 2
    paper_text = ''.join(page.get_text() for page in list(pdf)[:-1])
    assert '原題：' not in paper_text
    assert re.findall(r'\(\d{3}-\d+\)', paper_text) == [f"({q['year']}-{q['questionNumber']})" for q in questions], (subject, 'missing or repeated source markers')
    assert '參考答案' in pdf[-1].get_text()
    assert '參考答案' not in ''.join(page.get_text() for page in list(pdf)[1:-1])
    actual = pdf[-1].get_text().splitlines()
    start = actual.index('1')
    expected = []
    order = [2, 0, 3, 1]
    for index, question in enumerate(questions):
        key = question['answerKey']
        answer = '本題一律給分' if key['kind'] == 'all-credit' else '、'.join(chr(65 + order.index(option)) for option in key['options'])
        expected.extend([str(index + 1), answer])
    assert actual[start:start + len(expected)] == expected, (subject, 'shuffled answer key mismatch')
    image_count = sum(len(page.get_images()) for page in list(pdf)[:-1])
    assert image_count == sum(block['kind'] == 'image' for q in questions for block in q['content']), (subject, 'missing image')
    for page in pdf:
        assert f'頁次：{len(pdf)}-{page.number + 1}' in re.sub(r'\s+', '', page.get_text())
        for block in page.get_text('dict')['blocks']:
            if block['type'] != 0:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    x0, y0, x1, y1 = span['bbox']
                    assert 25 <= x0 <= x1 <= page.rect.width - 25, (subject, page.number, span['text'])
                    assert 10 <= y0 <= y1 <= page.rect.height - 10, (subject, page.number, span['text'])
                    assert '\ufffd' not in span['text'], (subject, 'missing font glyph')
                    if re.fullmatch(r'\(\d{3}-\d+\)', span['text']):
                        assert x0 > page.rect.width - 100 and y0 > 55, (subject, 'source not at question bottom-right')
                    if '頁次' in span['text']:
                        assert x0 > page.rect.width - 130 and y1 < 55, (subject, 'page number not top-right')
                    if re.search(r'[0-9]', span['text']):
                        assert 'Tinos' in span['font'] or 'TimesNewRoman' in span['font'], (subject, 'digits use wrong font')
        # Fail if a font has only logical text but no renderable glyph outlines.
        for font in {item[0] for item in page.get_fonts()}:
            name, ext, kind, data = pdf.extract_font(font)
            if data:
                parsed_font = pymupdf.Font(fontbuffer=data)
                assert parsed_font.glyph_count > 50, (subject, name, 'unrenderable embedded font')
    for index, label in [(0, 'first'), (len(pdf) - 1, 'answers')]:
        pdf[index].get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4)).save(OUTPUT / f'{subject}-{label}.png')
    # Contact sheet keeps all pages visible for inspecting pagination and figures.
    columns = 4
    thumb_width, thumb_height = 240, 350
    rows = (len(pdf) + columns - 1) // columns
    contact = pymupdf.open()
    sheet = contact.new_page(width=columns * thumb_width, height=rows * thumb_height)
    for index in range(len(pdf)):
        x, y = index % columns * thumb_width, index // columns * thumb_height
        sheet.show_pdf_page(pymupdf.Rect(x + 3, y + 3, x + thumb_width - 3, y + thumb_height - 3), pdf, index)
    sheet.get_pixmap().save(OUTPUT / f'{subject}-all-pages.png')
    print(json.dumps({'subject': subject, 'pages': len(pdf), 'images': image_count, 'answers': 50, 'bytes': file.stat().st_size}))
    count += 1
assert count == 4, 'Run desktop paper download tests for all four subjects first'
