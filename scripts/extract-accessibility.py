"""Capture every official PDF page, retaining layout text and page anchors."""
import json
import re
from pathlib import Path
import pymupdf

root = Path('ref/law-cloze')
for name in ['accessibility-current', 'accessibility-corrections']:
    document = pymupdf.open(root / (name + '.pdf'))
    pages = [{'page': page.number + 1, 'text': page.get_text(sort=True)} for page in document]
    (root / (name + '-pages.json')).write_text(json.dumps(pages, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(name + ': ' + str(len(pages)) + ' pages captured')
    if name == 'accessibility-current':
        provisions = []
        current = None
        for page in pages[7:]:
            for raw in page['text'].splitlines():
                line = raw.strip()
                if not line or re.fullmatch(r'\d+', line) or re.fullmatch(r'[圖表]\s*A?[\d.]+', line) or re.match(r'^(第[一二三四五六七八九十]+章|附錄|由前方|由左右側)', line):
                    continue
                match = re.match(r'^(A?\d{3,4}(?:\.\d+)*)(?:\s+|(?=[\u4e00-\u9fff]))', line)
                # Wrapped citations can begin with 202.4; only unindented headings start a provision.
                if match and not raw[:1].isspace():
                    current = {'number': match[1], 'page': page['page'], 'text': ''}
                    provisions.append(current)
                if current:
                    current['text'] += re.sub(r'\s+', '', line)
        (root / 'accessibility-provisions.json').write_text(json.dumps(provisions, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
