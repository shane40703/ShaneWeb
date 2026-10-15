"""Rebuild the licensed exam-paper font: pip install fonttools; run after question-data generation."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
import json
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
REVISION = 'ddda1877cfd3661fb5be11c493448df992192a8e'
BASE = f'https://raw.githubusercontent.com/lxgw/LxgwWenkaiTC/{REVISION}/'
CACHE = ROOT / 'test-results' / 'daily-font'
OUTPUT = ROOT / 'public' / 'fonts' / 'daily-paper'
CACHE.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
original = CACHE / 'LXGWWenKaiTC-Regular.ttf'
if not original.exists():
    original.write_bytes(urlopen(BASE + 'fonts/TTF/LXGWWenKaiTC-Regular.ttf').read())
texts = ['專門職業及技術人員高等考試建築師每日練習試題科目日期座號姓名注意事項本試題為選擇題請將答案填寫於括號內可在空白處計算作答本卷不附答案與詳解非正式考試原題年來源頁共題第備用含闖關結束繼續']
texts.extend(chr(i) for i in range(32, 127))
files = list((ROOT / 'public' / 'question-data').glob('*/*.json'))
if not files:
    raise RuntimeError('Run npm run generate:question-data first')
for file in files:
    for question in json.loads(file.read_text(encoding='utf-8')):
        texts.extend(block['text'] for block in question['content'] if block['kind'] == 'text')
        texts.extend(question['options'])
for file in (ROOT / 'src' / 'features' / 'daily').glob('daily-paper*.*'):
    texts.append(file.read_text(encoding='utf-8'))
texts.append((ROOT / 'src' / 'question-bank' / 'catalog.ts').read_text(encoding='utf-8'))
if hashlib.sha256(original.read_bytes()).hexdigest() != '6662480a3f95b4a90c80b189c679617a48adce3a505118a6af63ce5a482b83fa':
    raise RuntimeError('Upstream font checksum mismatch')
font = TTFont(original, recalcTimestamp=False)
characters = set(''.join(texts)) - set('\n\r\t')
characters.update(chr(code) for code in font.getBestCmap() if code < 0x3000)
missing = sorted(c for c in characters if ord(c) not in font.getBestCmap())
# Report missing glyphs instead of silently exporting empty squares.
print('Source SHA256:', hashlib.sha256(original.read_bytes()).hexdigest())
print('Missing glyphs:', ''.join(missing))
if missing:
    raise RuntimeError('Missing glyphs must be resolved before publishing')
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=''.join(characters))
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in (1, 2, 3, 4, 6):
        value = {1: 'Shane Daily Paper Kai', 2: 'Regular', 3: 'ShaneDailyPaperKai-Regular-1', 4: 'Shane Daily Paper Kai Regular', 6: 'ShaneDailyPaperKai-Regular'}[record.nameID]
        record.string = value.encode(record.getEncoding())
font.save(OUTPUT / 'paper-kai.ttf')
license_text = urlopen(BASE + 'OFL.txt').read().decode('utf-8')
(OUTPUT / 'OFL.txt').write_text('\n'.join(line.rstrip() for line in license_text.splitlines()) + '\n', encoding='utf-8')
print('Subset bytes:', (OUTPUT / 'paper-kai.ttf').stat().st_size)
