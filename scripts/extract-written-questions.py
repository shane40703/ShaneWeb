#!/usr/bin/env python3
"""擷取建築環控與建築結構試卷中的申論題。

來源 PDF 同時含申論題與選擇題；本工具只截取「甲、申論題部分」，並為
每題建立獨立文字、metadata 與人工補圖資料夾。既有 images 內容不會刪除。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pymupdf


SUBJECTS = {
    "環控": {"id": "environment", "name": "建築環境控制"},
    "結構": {"id": "structure", "name": "建築結構"},
}

CHINESE_NUMBERS = "一二三四五六七八九十"
QUESTION_BOUNDARY = re.compile(rf"(?m)^\s*([{CHINESE_NUMBERS}]+)、\s*")
PAGE_MARKER = re.compile(r"\[\[PAGE:(\d+)\]\]")
IMAGE_REFERENCE = re.compile(
    r"(?:如下圖|下圖|如圖所示|如右圖|如左圖|右圖所示|左圖所示|"
    r"圖示(?:之|的|為|剛|構|A|B|C)|附圖|剖面示意圖|平面圖|關係圖|"
    r"所示(?:桁架|構架|梁|剛架|斷面)|虛線部分所示|斷面形狀)"
)

CHAR_REPLACEMENTS = {
    "\ue129": "(1)",
    "\ue12a": "(2)",
    "\ue12b": "(3)",
    "\ue12c": "(4)",
    "\ue12d": "(5)",
    "\uf03d": "=",
    "\uf0b4": "×",
    "\uf0b1": "±",
    "\uf02b": "+",
    "\uf06c": "λ",
    "\uf0a2": "′",
}

HEADER_PATTERNS = (
    re.compile(r"^代號[:：].*頁次[:：]"),
    re.compile(r"^代號[:：]"),
    re.compile(r"^頁次[:：]"),
    re.compile(r"^\d{3}年專門職業"),
    re.compile(r"^專門職業及技術人員"),
    re.compile(r"^暨?普通考試"),
    re.compile(r"^食品技師考試"),
)


@dataclass(frozen=True)
class WrittenQuestion:
    number: int
    text: str
    pages: list[int]
    has_image: bool
    warnings: list[str]


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    for old, new in CHAR_REPLACEMENTS.items():
        value = value.replace(old, new)
    return value.replace("\u00a0", " ").replace("\u200b", "")


def compact_line(value: str) -> str:
    return re.sub(r"[ \t]+", " ", normalize(value)).strip()


def smart_join(left: str, right: str) -> str:
    if not left:
        return right
    if not right:
        return left
    if left.endswith(("-", "–")):
        return left + right
    if left[-1].isascii() and right[0].isascii() and left[-1].isalnum() and right[0].isalnum():
        return f"{left} {right}"
    return left + right


def clean_question_text(raw: str) -> str:
    lines: list[str] = []
    for raw_line in PAGE_MARKER.sub("", raw).splitlines():
        line = compact_line(raw_line)
        if not line or any(pattern.search(line) for pattern in HEADER_PATTERNS):
            continue
        lines.append(line)

    paragraphs: list[str] = []
    for line in lines:
        if re.match(r"^\([1-9]\)", line):
            paragraphs.append(line)
        elif paragraphs:
            paragraphs[-1] = smart_join(paragraphs[-1], line)
        else:
            paragraphs.append(line)
    return "\n".join(paragraphs).strip()


def page_at(full_text: str, position: int) -> int:
    markers = list(PAGE_MARKER.finditer(full_text, 0, position))
    return int(markers[-1].group(1)) if markers else 1


def extract_questions(pdf_path: Path) -> list[WrittenQuestion]:
    with pymupdf.open(pdf_path) as document:
        full_text = "\n".join(
            f"[[PAGE:{index + 1}]]\n{normalize(page.get_text('text', sort=True))}"
            for index, page in enumerate(document)
        )

    section_start = full_text.find("甲、申論題部分")
    section_end = full_text.find("乙、測驗題部分")
    if section_start < 0 or section_end <= section_start:
        raise ValueError("找不到完整的申論題區段")

    section = full_text[section_start:section_end]
    boundaries = list(QUESTION_BOUNDARY.finditer(section))
    if not boundaries:
        raise ValueError("申論題區段內找不到題號")

    questions: list[WrittenQuestion] = []
    for index, boundary in enumerate(boundaries):
        start = section_start + boundary.end()
        end = (
            section_start + boundaries[index + 1].start()
            if index + 1 < len(boundaries)
            else section_end
        )
        raw = full_text[start:end]
        text = clean_question_text(raw)
        pages = [page_at(full_text, start)]
        page_markers = list(PAGE_MARKER.finditer(raw))
        for marker_index, marker in enumerate(page_markers):
            chunk_end = (
                page_markers[marker_index + 1].start()
                if marker_index + 1 < len(page_markers)
                else len(raw)
            )
            if clean_question_text(raw[marker.end():chunk_end]):
                pages.append(int(marker.group(1)))
        pages = sorted(set(pages))
        has_image = bool(IMAGE_REFERENCE.search(text))
        unknown = sorted(
            {
                char
                for char in text
                if 0xE000 <= ord(char) <= 0xF8FF
            },
            key=ord,
        )
        warnings: list[str] = []
        if len(text) < 12:
            warnings.append("題目文字偏短，請對照原 PDF")
        if unknown:
            warnings.append(
                "含未轉換特殊字元: "
                + ", ".join(f"U+{ord(char):04X}" for char in unknown)
            )
        questions.append(
            WrittenQuestion(
                number=index + 1,
                text=text,
                pages=pages,
                has_image=has_image,
                warnings=warnings,
            )
        )
    return questions


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_question_set(
    output_root: Path,
    pdf_path: Path,
    year: int,
    subject_directory: str,
    questions: list[WrittenQuestion],
) -> None:
    subject = SUBJECTS[subject_directory]
    target = output_root / str(year) / str(subject["id"])
    target.mkdir(parents=True, exist_ok=True)

    for question in questions:
        question_root = target / f"{question.number:03d}"
        image_root = question_root / "images"
        image_root.mkdir(parents=True, exist_ok=True)
        (image_root / ".gitkeep").touch(exist_ok=True)
        (question_root / "question.txt").write_text(
            question.text + "\n", encoding="utf-8"
        )
        metadata = {
            "year": year,
            "subject": subject["id"],
            "subjectName": subject["name"],
            "questionNumber": question.number,
            "format": "written",
            "hasImage": question.has_image,
            "imageFile": "images/figure1.png" if question.has_image else None,
            "imageReasons": ["題幹引用附圖"] if question.has_image else [],
            "sourcePages": question.pages,
            "warnings": question.warnings,
        }
        (question_root / "metadata.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    image_lines = [
        f"# {year} 年{subject['name']}申論題 - 需要人工補圖",
        "",
        "請把圖片放進指定題目的 `images` 資料夾；檔名可使用 `image.png`。",
        "",
    ]
    image_questions = [question for question in questions if question.has_image]
    if image_questions:
        image_lines.extend(
            f"- [ ] 申論第 {question.number} 題（PDF 第 {'、'.join(map(str, question.pages))} 頁）"
            for question in image_questions
        )
    else:
        image_lines.append("本年度未偵測到需補圖的申論題。")
    (target / "image_questions.md").write_text(
        "\n".join(image_lines).rstrip() + "\n", encoding="utf-8"
    )

    warning_lines = [f"# {year} 年{subject['name']}申論題 - 擷取警告", ""]
    warnings = [
        f"- [ ] 申論第 {question.number} 題: {warning}"
        for question in questions
        for warning in question.warnings
    ]
    warning_lines.extend(warnings or ["沒有自動檢查警告。"])
    (target / "review_warnings.md").write_text(
        "\n".join(warning_lines).rstrip() + "\n", encoding="utf-8"
    )

    source = {
        "year": year,
        "subject": subject["id"],
        "subjectName": subject["name"],
        "sourceFile": pdf_path.name,
        "sourcePath": str(pdf_path),
        "sourceSha256": sha256(pdf_path),
        "questionCount": len(questions),
        "imageQuestionCount": len(image_questions),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    (target / "source.json").write_text(
        json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def write_reports(output_root: Path, records: list[dict[str, object]]) -> None:
    records.sort(key=lambda item: (int(item["year"]), str(item["subject"])))
    (output_root / "index.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    total_questions = sum(int(record["questionCount"]) for record in records)
    total_images = sum(int(record["imageQuestionCount"]) for record in records)
    report = [
        "# 申論題擷取報告",
        "",
        f"- PDF: {len(records)} 份",
        f"- 申論題: {total_questions} 題",
        f"- 偵測需人工補圖: {total_images} 題",
        "",
        "## 各年度",
        "",
    ]
    for record in records:
        report.append(
            f"- {record['year']} 年{record['subjectName']}: "
            f"{record['questionCount']} 題，需補圖 {record['imageQuestionCount']} 題"
        )
    (output_root / "import_report.md").write_text(
        "\n".join(report).rstrip() + "\n", encoding="utf-8"
    )

    checklist = [
        "# 申論題圖片待補清單",
        "",
        f"共 {total_images} 題。請把圖片放入對應題目的 `images` 資料夾。",
        "",
    ]
    for record in records:
        if not int(record["imageQuestionCount"]):
            continue
        checklist.extend(
            [
                f"## {record['year']} 年{record['subjectName']}",
                "",
                f"請查看 `{record['year']}/{record['subject']}/image_questions.md`。",
                "",
            ]
        )
    (output_root / "image_checklist.md").write_text(
        "\n".join(checklist).rstrip() + "\n", encoding="utf-8"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="擷取環控與結構申論題")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("WrittenQuestionInfo"))
    parser.add_argument("--years", default="100-114")
    args = parser.parse_args()

    start, end = (int(value) for value in args.years.split("-", maxsplit=1))
    input_root = args.input.resolve()
    output_root = args.output.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []

    for year in range(start, end + 1):
        for subject_directory, subject in SUBJECTS.items():
            pdf_path = input_root / subject_directory / f"{year}.pdf"
            if not pdf_path.is_file():
                raise FileNotFoundError(f"找不到試卷: {pdf_path}")
            questions = extract_questions(pdf_path)
            write_question_set(
                output_root, pdf_path, year, subject_directory, questions
            )
            image_count = sum(question.has_image for question in questions)
            records.append(
                {
                    "year": year,
                    "subject": subject["id"],
                    "subjectName": subject["name"],
                    "questionCount": len(questions),
                    "imageQuestionCount": image_count,
                    "path": f"{year}/{subject['id']}",
                }
            )
            print(
                f"{year} 年{subject['name']}: {len(questions)} 題，需補圖 {image_count} 題"
            )

    write_reports(output_root, records)
    print(
        f"完成: {sum(int(record['questionCount']) for record in records)} 題，"
        f"輸出至 {output_root}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
