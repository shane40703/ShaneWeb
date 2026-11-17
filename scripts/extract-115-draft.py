"""Extract a review draft from 115 exam PDFs. Does not edit the source PDFs."""
import argparse
import json
import re
import sys
from pathlib import Path

import pymupdf

sys.stdout.reconfigure(encoding='utf-8')
SUBJECTS = {'法規': ('regulations', 80), '構造': ('construction', 80), '環控': ('environment', 40), '結構': ('structure', 40)}
CHOICES = {'\ue18c': 'A', '\ue18d': 'B', '\ue18e': 'C', '\ue18f': 'D'}
SYMBOLS = {'\uf0b4': '×', '\uf0b1': '±', '\uf03d': '=', '\uf0b7': '·', '\uf0d7': '×', '\uf02d': '−', '\uf0b3': '≥', '\uf0a3': '≤', '\uf06c': 'λ', '\uf061': 'α', '\uf062': 'β', '\uf067': 'γ', '\uf064': 'δ', '\uf070': 'π', '\uf073': 'σ', '\uf074': 'τ', '\uf066': 'φ', '\uf071': 'θ', '\uf06d': 'μ', '\uf06e': 'ν', '\uf077': 'ω', '\uf044': 'Δ', '\uf053': 'Σ', '\uf0a2': '′', '\uf0b0': '°', '\uf0b8': '÷', '\uf02b': '+', '\uf0d6': '√', '\uf0b9': '≠', '\uf0ae': '→'}
FIGURE = re.compile(r'下圖|附圖|如圖|圖所示|圖示|(?<!網)圖中|示意圖|示意如下|下列圖|如下所示|所示之圖')

def answers(path, total):
    page = pymupdf.open(path)[0]
    result = {}
    for x0, y0, x1, y1, text, *_ in page.get_text('words'):
        if re.fullmatch('[A-D]', text):
            col = round((x0 - 86) / 50)
            row = round((y0 - 261.6) / 45.15)
            if 0 <= col <= 9 and 0 <= row <= 9 and abs(x0 - (86 + col * 50)) < 5 and abs(y0 - (261.6 + row * 45.15)) < 5:
                number = row * 10 + col + 1
                if number <= total:
                    if number in result: raise ValueError(f'duplicate answer {number}')
                    result[number] = text
    if set(result) != set(range(1, total + 1)):
        raise ValueError(f'{path}: missing answers {set(range(1, total + 1)) - set(result)}')
    return result

def extract(path, total):
    doc = pymupdf.open(path)
    collected = []
    index = 0
    for page_num, page in enumerate(doc, 1):
        image_rects = [rect for image in page.get_images() for rect in page.get_image_rects(image) if rect.width > 30 and rect.height > 20]
        lines = []
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text = ''.join(span['text'] for span in line['spans']).strip()
                box = pymupdf.Rect(line['bbox'])
                center = pymupdf.Point((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2)
                # Diagram labels may be stored after all text on the page, even
                # when the illustration belongs to an earlier question.
                if text and not any(center in rect for rect in image_rects):
                    lines.append((text, line['bbox']))
        # PDF content streams can place diagram labels after later questions.
        # Restore visual top-to-bottom order before identifying question ranges.
        lines.sort(key=lambda item: (round(item[1][1] / 3), item[1][0]))
        for text, bbox in lines:
            if re.fullmatch(r'\d{1,2}', text) and bbox[0] < 65 and int(text) == index + 1:
                index += 1
                collected.append({'number': index, 'page': page_num, 'y': bbox[1], 'lines': [], 'pages': [page_num]})
                continue
            if index == 0 or bbox[1] < 70 or bbox[1] > 812:
                continue
            if re.match(r'^(代號[:：]|頁次[:：]|請接背面|背面尚有試題|全[一二三四五六七八九十\d]+頁)', text):
                continue
            collected[-1]['lines'].append(text)
            if page_num not in collected[-1]['pages']: collected[-1]['pages'].append(page_num)
    if index != total: raise ValueError(f'{path}: found {index}/{total} questions')
    for i, question in enumerate(collected):
        raw = '\n'.join(question.pop('lines'))
        for char, label in CHOICES.items(): raw = raw.replace(char, f'\n[[{label}]]')
        for char, value in SYMBOLS.items(): raw = raw.replace(char, value)
        markers = list(re.finditer(r'\[\[([A-D])\]\]', raw))
        question['warnings'] = []
        if sorted(m.group(1) for m in markers) != list('ABCD'):
            question['warnings'].append('選項標記不完整或順序異常')
        def clean(text):
            text = re.sub(r'[ \t]+', ' ', text).strip()
            return re.sub(r'\s*\n\s*', ' ', text)
        question['prompt'] = clean(raw[:markers[0].start()] if markers else raw)
        question['options'] = {m.group(1): clean(raw[m.end(): markers[j+1].start() if j+1 < len(markers) else len(raw)]) for j, m in enumerate(markers)}
        unknown = sorted(set(re.findall(r'[\ue000-\uf8ff]', raw)))
        if unknown: question['warnings'].append('特殊符號：' + ', '.join(f'U+{ord(c):04X}' for c in unknown))
        question['figures'] = []
        if FIGURE.search(raw): question['figures'].append('題目文字引用圖示')
        if re.search(r'承上題|續上題|接續上題', question['prompt']):
            question['figures'].append('承接上題，需核對上題附圖')
        next_q = collected[i+1] if i+1 < len(collected) else None
        for page_no in question['pages']:
            page = doc[page_no-1]
            y0 = question['y'] if page_no == question['page'] else 70
            y1 = next_q['y'] if next_q and next_q['page'] == page_no else page.rect.height - 25
            rect = pymupdf.Rect(35, y0, page.rect.width - 30, y1)
            if any(rect.intersects(r) and r.width > 30 and r.height > 20 for img in page.get_images() for r in page.get_image_rects(img)):
                question['figures'].append(f'PDF 第 {page_no} 頁包含圖片')
            vectors = [d['rect'] for d in page.get_drawings() if rect.intersects(d['rect']) and d['rect'].width > 20 and d['rect'].height > 10]
            if vectors: question['figures'].append(f'PDF 第 {page_no} 頁可能包含向量圖表')
        question['figures'] = list(dict.fromkeys(question['figures']))
    if path.name == '構造115.pdf':
        collected[9]['options']['A'] = '依現行「建築物磚構造設計及施工規範」規定，建築用普通磚使用於結構牆，應符合 230 mm × 110 mm × 60 mm（±1.5%）'
        collected[9]['options']['B'] = '承上述，建築用普通磚使用於非結構牆，應符合 200 mm × 95 mm × 53 mm（±2%）'
    if path.name == '環控115.pdf':
        collected[1]['prompt'] = '依材料之熱傳導係數（W/m·K）由小至大排列，下列何者正確？'
        collected[8]['prompt'] = '某間辦公室室內容積 150 m³，油漆新塗裝的牆面面積為 30 m²，該牆面的總揮發性有機化合物 TVOC 逸散速率為 0.3 mg/m²·h，欲將室內 TVOC 濃度控制在 0.5 mg/m³ 時，所需換氣量為多少 CMH？'
    if path.name == '結構115.pdf':
        # These formulas have vector square roots or overlapping sub/superscripts;
        # they have been transcribed against the rendered original pages.
        collected[2]['prompt'] = '某均質且等向（Homogeneous and isotropic）材料，若其材料波松比 ν = 0.3，則其剪力模數 G 約是彈性模數 E 的多少倍？'
        collected[3]['prompt'] = re.sub(r'\s+200\s+載重.*$', '', collected[3]['prompt'])
        collected[6]['prompt'] = collected[6]['prompt'].replace('波松比 0.3 =', '波松比 = 0.3')
        collected[6]['options']['B'] = '平均剪應力為 2.5 MPa'
        collected[6]['options']['C'] = 'G = 27.8 MPa'
        collected[6]['options']['D'] = '剪力方向勁度 = 12.5 kN/cm'
        for label in ('A', 'B', 'D'):
            collected[14]['options'][label] = collected[14]['options'][label].replace('5 2t', '5√2 t')
        collected[16]['prompt'] = re.sub(r'\s+B C D 12 kN 12 kN$', '', collected[16]['prompt'])
        collected[17]['options']['C'] = '√2P'
        collected[17]['prompt'] = re.sub(r'\s+P P$', '', collected[17]['prompt'])
        collected[19]['prompt'] = re.sub(r'\s+3 m 3 m 30 kN 4 m$', '', collected[19]['prompt'])
        collected[21]['prompt'] = re.sub(r'\s+P P P P \(a\) \(b\) \(c\) \(d\)$', '', collected[21]['prompt'])
        collected[24]['prompt'] = re.sub(r'\s+\(i\) \(iii\) \(ii\)$', '', collected[24]['prompt'])
        collected[28]['options']['D'] = re.sub(r'\s+cf ′為210 kgf/cm2，鋼$', '', collected[28]['options']['D'])
        collected[29]['prompt'] = ('已知鋼筋混凝土梁斷面的寬及有效深度分別為 30 及 45 cm，混凝土之 f′c 為 210 kgf/cm²，鋼筋之 fy 為 2800 kgf/cm²。若垂直剪力肋筋採 #3 鋼筋，間距 20 cm（Av/s = 0.071），則該梁斷面之剪力計算強度 Vn 為何？\nVn = Vc + Vs = 0.53√f′c × b × d + fy × Av × d/s')
        collected[29]['figures'] = []  # The detected vector is a radical, not an illustration.
        collected[30]['options']['D'] = '提升混凝土抗壓強度 f′c'
    return collected

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = {}
    for name, (subject, count) in SUBJECTS.items():
        questions = extract(args.input / f'{name}115.pdf', count)
        keys = answers(args.input / f'{name}答案.pdf', count)
        for item in questions: item['answer'] = keys[item['number']]
        result[subject] = questions
        print(name, 'questions', len(questions), 'images', sum(bool(q['figures']) for q in questions), 'warnings', sum(bool(q['warnings']) for q in questions))
        for q in questions:
            if q['warnings']: print('  ', q['number'], q['warnings'])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__': main()
