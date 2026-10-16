"""Rebuild the licensed exam-paper font: pip install fonttools; run after question-data generation."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
import json
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parents[1]
REVISION = 'f8d157532fbfaeda587e826d4cd5b21a49186f7c'
BASE = f'https://raw.githubusercontent.com/notofonts/noto-cjk/{REVISION}/Serif/'
CACHE = ROOT / 'test-results' / 'daily-font'
OUTPUT = ROOT / 'public' / 'fonts' / 'daily-paper'
CACHE.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
original = CACHE / 'NotoSerifCJKtc-Regular.otf'
if not original.exists():
    original.write_bytes(urlopen(BASE + 'OTF/TraditionalChinese/NotoSerifCJKtc-Regular.otf').read())
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
latin_original = CACHE / 'Tinos-Regular.ttf'
LATIN_BASE = 'https://raw.githubusercontent.com/google/fonts/ba95515f1333efe9342c2ad988b9c2f6bef6dbad/ofl/tinos/'
if not latin_original.exists():
    latin_original.write_bytes(urlopen(LATIN_BASE + 'Tinos-Regular.ttf').read())
if hashlib.sha256(latin_original.read_bytes()).hexdigest() != '60a0e8ef0c04dd5dd69ffe91025fa2ae5836cbd35600a82ba031977557e2cb61':
    raise RuntimeError('Latin font checksum mismatch')
latin = TTFont(latin_original, recalcTimestamp=False)
font = TTFont(original, recalcTimestamp=False)
if hashlib.sha256(original.read_bytes()).hexdigest() != '234301038e76e7c35c43113785024700c4e4fe7bdce1d1fbbc42fca7e6683798':
    raise RuntimeError('Chinese font checksum mismatch')
characters = set(''.join(texts)) - set('\n\r\t')
characters.update(chr(code) for code in font.getBestCmap() if code < 0x3000)
missing = sorted(c for c in characters if ord(c) not in font.getBestCmap() and ord(c) not in latin.getBestCmap() and ord(c) != 0x22C5)
# Report missing glyphs instead of silently exporting empty squares.
print('Source SHA256:', hashlib.sha256(original.read_bytes()).hexdigest())
print('Missing glyphs:', ascii(''.join(missing)))
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
        value = {1: 'Shane Daily Paper Ming', 2: 'Regular', 3: 'ShaneDailyPaperMing-Regular-1', 4: 'Shane Daily Paper Ming Regular', 6: 'ShaneDailyPaperMing-Regular'}[record.nameID]
        record.string = value.encode(record.getEncoding())
if 'CFF ' in font:
    font['CFF '].cff.fontNames = ['ShaneDailyPaperMing-Regular']
    font['CFF '].cff.topDictIndex[0].FullName = 'Shane Daily Paper Ming Regular'
    font['CFF '].cff.topDictIndex[0].FamilyName = 'Shane Daily Paper Ming'
# Convert the offline CFF subset into TrueType for consistent PDF-viewer support.
glyph_set = font.getGlyphSet()
glyph_order = font.getGlyphOrder()
glyphs = {}
for name in glyph_order:
    pen = TTGlyphPen(glyph_set)
    glyph_set[name].draw(Cu2QuPen(pen, max_err=1.0, reverse_direction=True))
    glyphs[name] = pen.glyph()
builder = FontBuilder(font['head'].unitsPerEm, isTTF=True)
builder.setupGlyphOrder(glyph_order)
builder.setupCharacterMap(font.getBestCmap())
builder.setupGlyf(glyphs)
builder.setupHorizontalMetrics(font['hmtx'].metrics)
builder.setupHorizontalHeader(ascent=font['hhea'].ascent, descent=font['hhea'].descent)
builder.setupOS2()
builder.font['OS/2'] = font['OS/2']
builder.font['name'] = font['name']
builder.font['head'].created = font['head'].created
builder.font['head'].modified = font['head'].modified
builder.font.recalcTimestamp = False
builder.setupPost(keepGlyphNames=False)
builder.setupMaxp()
builder.save(OUTPUT / 'paper-ming.ttf')
latin_subsetter = subset.Subsetter(options=options)
latin_subsetter.populate(unicodes=list(latin.getBestCmap()))
latin_subsetter.subset(latin)
latin.save(OUTPUT / 'paper-times.ttf')
license_text = urlopen(BASE + 'LICENSE').read().decode('utf-8')
(OUTPUT / 'OFL.txt').write_text('\n'.join(line.rstrip() for line in license_text.splitlines()) + '\n', encoding='utf-8')
latin_license = urlopen('https://raw.githubusercontent.com/googlefonts/tinos/3b4482a99b80ea5fc75f187b1be3120a3f5905b3/OFL.txt').read().decode('utf-8')
(OUTPUT / 'OFL-Tinos.txt').write_text('\n'.join(line.rstrip() for line in latin_license.splitlines()) + '\n', encoding='utf-8')
print('Subset bytes:', (OUTPUT / 'paper-ming.ttf').stat().st_size)
