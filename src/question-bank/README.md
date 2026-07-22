# 靜態考古題資料夾

題庫以「科目／年度／題號」存放。Next.js 在 `next build` 的 `getStaticProps` 階段直接讀取檔案，並為每一題產生獨立的靜態 HTML；沒有額外的 preprocessing 或 generated data。

```text
src/question-bank/
├── schema.ts
├── registry.ts
├── law/
├── env/
├── construction/
│   └── 114/
│       ├── paper.ts
│       ├── source/paper.pdf
│       └── 49/
│           ├── meta.ts
│           ├── question-01.txt
│           ├── question-02.png
│           ├── A.txt
│           ├── B.txt
│           ├── C.txt
│           └── D.txt
└── structure/
```

## 題目檔案規則

- 科目資料夾固定為 `law`、`env`、`construction`、`structure`。
- 年度使用三位數民國年，題號資料夾使用兩位數。
- 題幹檔名為 `question-NN.txt` 或 `question-NN.png|jpg|jpeg|webp`；文字與圖片依 `NN` 由小到大顯示。
- 每題必須有 `A.txt`、`B.txt`、`C.txt`、`D.txt`，選項只接受非空白純文字，不接受圖片。
- `explanation.txt` 可省略；存在時不可為空白。
- `meta.ts` 放分類、主題、標籤、答案、來源及圖片資料，不使用 `meta.json`。
- 官方年度可用 `paper.ts` 記錄試卷、答案與更正答案來源；原始 PDF 可封存於 `source/`。

分類、主題與標籤由 [`schema.ts`](./schema.ts) 的 `categoryCatalog` 限制。新增分類時先更新該表，再於題目的 `meta.ts` 使用 `defineQuestionMeta()`，TypeScript 會阻止跨科目或不存在的分類字串。

有題目圖片時，由同一題的 `meta.ts` 靜態匯入，讓 Next.js 在 build 階段處理圖片：

```ts
import question02 from './question-02.png';

images: {
  'question-02.png': { src: question02, alt: '題目圖片說明' },
}
```

答案可接受多個官方答案：

```ts
answerKey: { kind: 'accepted', options: ['A', 'B'] }
```

若公告為一律給分：

```ts
answerKey: { kind: 'all-credit' }
```

## 新增題目

建立題目資料夾與上述檔案後，在 [`registry.ts`](./registry.ts) 靜態匯入該題的 `meta.ts`，並新增一筆 `registerQuestion()`。這份明確 registry 讓 TypeScript/Next.js 知道需要編譯哪些 metadata 與圖片，不需要掃描後再產生程式碼。

每題路徑格式為 `/questions/[subject]/[year]/[number]`。`next build` 會直接讀取 txt、驗證選項與圖片規則，並產生所有已登記題目的靜態頁面。
