# 靜態考古題資料夾

題庫內容放在 `public/question-bank`，以「科目／年度／題號」存放。這棵目錄是題目清單的唯一資料來源；Next.js 在 `getStaticPaths` 與 `getStaticProps` 階段直接掃描、驗證並讀取資料，不使用 registry、prebuild script 或 generated data。

```text
public/question-bank/
├── 法規/
├── 環控/
├── 構造/
│   └── 114/
│       ├── paper.json
│       ├── source/paper.pdf
│       └── 49/
│           ├── meta.json
│           ├── question-01.txt
│           ├── question-02.png
│           ├── A.txt
│           ├── B.txt
│           ├── C.txt
│           └── D.txt
└── 結構/
```

程式碼與資料規則保留在 `src/question-bank`：

- `catalog.ts` 定義科目 ID、顯示名稱及資料夾名稱。
- `schema.ts` 定義分類目錄、答案與來源型別。
- `../server/question-bank.server.ts` 掃描並驗證實際資料。

## 題目檔案規則

- 科目 ID 與資料夾由 `catalog.ts` 唯一對應，例如 `law` → `法規`。
- 年度使用三位數民國年，題號資料夾使用兩位數。
- `subject`、`year`、`questionNumber` 由目錄路徑推導，不寫入 metadata。
- 題幹檔名為 `question-NN.txt` 或 `question-NN.png|jpg|jpeg|webp`；文字與圖片依 `NN` 由小到大顯示，編號不可重複。
- 每題必須有非空白的 `A.txt`、`B.txt`、`C.txt`、`D.txt`。
- `explanation.txt` 可省略；存在時不可為空白。
- 每題必須有 `meta.json`；官方年度可用 `paper.json` 記錄試卷、答案與更正答案來源。
- 原始 PDF 可封存於年度的 `source/`。
- 題目資料位於 `public`，因此 JSON、文字、圖片與封存 PDF 都可由公開 URL 存取。

## Metadata

`meta.json` 只保存無法從路徑或檔案推導的語意資料：

```json
{
  "primaryCategory": "防水工程",
  "topic": "屋頂防水",
  "tags": ["防水工程"],
  "answerKey": {
    "kind": "accepted",
    "options": ["A", "B"]
  },
  "provenance": {
    "kind": "official",
    "page": 7
  },
  "images": {
    "question-02.png": {
      "alt": "圖 A 至圖 D 四種屋頂設備基礎防水收頭細部剖面圖"
    }
  }
}
```

分類、主題與標籤必須符合 `schema.ts` 的 `categoryCatalog`。Loader 也會驗證 JSON 欄位、答案、來源、圖片宣告及資料夾內容；無效資料會讓測試或 `next build` 直接失敗。

圖片的 URL、寬度和高度不寫入 JSON：URL 由題目路徑推導，實際尺寸由 loader 使用 Sharp 讀取圖片 metadata。頁面會把尺寸交給 Next Image，讓瀏覽器在圖片下載前保留正確比例，避免圖片造成 CLS。只有無法由圖片推導的 `alt` 需要維護在 `meta.json`。

答案可接受多個官方答案：

```json
{
  "answerKey": {
    "kind": "accepted",
    "options": ["A", "B"]
  }
}
```

若公告為一律給分：

```json
{
  "answerKey": {
    "kind": "all-credit"
  }
}
```

## 新增題目

在對應科目與年度下建立兩位數題號資料夾，加入 `meta.json`、題幹和四個選項即可。Loader 會自動發現新目錄，下一次開發載入或 build 時就會產生 `/questions/[subject]/[year]/[number]` 靜態頁面，不需要修改其他清單檔案。

113 年完整題庫可由已校對的 `QuestionInfo/113` 與 `AnswersInfo/*/113.txt`
重新產生：

```bash
npm run import:113
```

匯入器會重建四科的 113 年目錄、複製題目附圖，並寫入正式試卷來源與答案資料。
