"""Save the reviewed extraction into new 115-only source folders; never overwrite a prior import."""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path.cwd()
PDF_ROOT = Path(r'C:\Users\pre-user\Desktop\115')
draft_path = ROOT / 'tmp/115/draft.json'
draft = json.loads(draft_path.read_text(encoding='utf-8'))
subjects = {'regulations': '營建法規與實務', 'environment': '建築環境控制', 'construction': '建築構造與施工', 'structure': '建築結構'}
targets = [ROOT / 'QuestionInfo/115', ROOT / 'WrittenQuestionInfo/115']
targets += [ROOT / 'AnswersInfo' / subject / '115.txt' for subject in subjects]
targets += [ROOT / 'public/question-bank' / subject / '115' for subject in ('法規', '環控', '構造', '結構')]
conflicts = [str(p) for p in targets if p.exists()]
if conflicts:
    raise SystemExit('Refusing to overwrite existing 115 data: ' + ', '.join(conflicts))

spec = importlib.util.spec_from_file_location('written_115', ROOT / 'scripts/extract-written-questions.py')
written = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = written
spec.loader.exec_module(written)

checklist = ['# 115 年題目圖片待補清單', '', '以下為自動偵測並對照試卷的待補項目。選項圖片請包含 A～D 所有圖；第 15 題須使用第 14 題同一張圖。', '圖片請放入每題的 `images/figure1.png`；補圖後重新匯入，步驟見本清單下方。', '']
for subject, title in subjects.items():
    entries = draft[subject]
    answer_path = ROOT / 'AnswersInfo' / subject / '115.txt'
    answer_path.parent.mkdir(parents=True, exist_ok=True)
    answer_path.write_text(''.join(f"{q['number']}={q['answer']}\n" for q in entries), encoding='utf-8')
    img_items = []
    for q in entries:
        folder = ROOT / 'QuestionInfo/115' / subject / f"{q['number']:03}"
        image_dir = folder / 'images'
        image_dir.mkdir(parents=True, exist_ok=False)
        (image_dir / '.gitkeep').touch()
        option_text = []
        for label in 'ABCD':
            value = q['options'].get(label, '').strip() or f'附圖選項（{label}）'
            option_text.append(f'{label}. {value}')
        picture = '\n[圖片：待人工截圖]\n' if q['figures'] else ''
        (folder / 'question.txt').write_text(f"{q['number']}. {q['prompt']}\n{picture}\n" + '\n'.join(option_text) + '\n', encoding='utf-8')
        metadata = {'year': 115, 'subject': subject, 'subjectName': title, 'questionNumber': q['number'], 'hasImage': bool(q['figures']), 'imageFile': 'images/figure1.png' if q['figures'] else None, 'imageReasons': q['figures'], 'sourcePages': q['pages'], 'warnings': q['warnings']}
        (folder / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        if q['figures']:
            pages = '、'.join(map(str, q['pages']))
            img_items.append(f"- [ ] 第 {q['number']:02} 題：PDF 第 {pages} 頁 → `QuestionInfo/115/{subject}/{q['number']:03}/images/figure1.png`（{'、'.join(q['figures'])}）")
    checklist.extend([f'## {title}・選擇題', '', *(img_items or ['無偵測到需要圖片的題目。']), ''])

for directory, subject in written.SUBJECTS.items():
    path = PDF_ROOT / f'{directory}115.pdf'
    questions = written.extract_questions(path)
    written.write_question_set(ROOT / 'WrittenQuestionInfo', path, 115, directory, questions)
    lines = [f"- [ ] 申論第 {q.number} 題：PDF 第 {'、'.join(map(str, q.pages))} 頁 → `WrittenQuestionInfo/115/{subject['id']}/{q.number:03}/images/figure1.png`" for q in questions if q.has_image]
    checklist.extend([f"## {subject['name']}・申論題", '', *(lines or ['無偵測到需要圖片的題目。']), ''])

checklist.extend(['## 補圖後更新網頁', '', '圖片補入上述來源資料夾後，在專案根目錄執行：', '', '```powershell', 'node scripts/import-113-question-bank.mjs 115', 'node scripts/import-written-question-bank.mjs 115', 'npm.cmd run generate:question-data', '```', '', '這些匯入指令會更新 115 年的網站題目檔案；重新匯入前，請確定人工圖片都放在來源資料夾，並保留任何已手動修改的網站題目文字。', ''])
(ROOT / 'QuestionInfo/115/image_checklist.md').write_text('\n'.join(checklist), encoding='utf-8')
print('Saved 240 multiple-choice questions and written questions; see QuestionInfo/115/image_checklist.md')
