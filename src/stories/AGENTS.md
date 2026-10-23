# Storybook 故事規則

Storybook 用來在不操作網站的情況下，直接看到並調整網站目前的 UI。
執行 `npm run storybook`（http://localhost:6006），輸出靜態版用 `npm run build-storybook`。

## 故事分成兩類

### Components：單一元件

- 一個網站元件一個故事檔，例如難題按鈕、文字格式工具列、筆記圖片上傳。只在另一個元件裡
  出現的元件（例如圖片放大 ImageLightbox、科目圖示 SubjectIcon）在那個元件的故事裡操作，
  不另外寫。
- 元件的各種狀態（未標記／已標記、空白／有內容、停用……）用 Controls 切換或直接在畫面上
  操作，方便單獨調整外觀。
- 標題：`Components/<分類>/<元件名稱>`，元件名稱用程式裡的名稱，例如
  `Components/題目/DifficultButton`。meta 的 `component` 放網站元件本身；需要包一層
  才能操作時用 `render`，不要把包裝元件當成 `component`。
- 檔案放在 `src/stories/components/<分類資料夾>/`。分類：

  | 分類 | 資料夾 | 放什麼 |
  | --- | --- | --- |
  | 基礎 UI | `ui/` | 按鈕、選單、選項、通知、對話框、抽屜、標籤、空白狀態、科目徽章、分頁 |
  | 文字 | `text/` | 題目與筆記的文字格式（RichText、格式工具列） |
  | 題目 | `question/` | 題目內容、題號、選題、作答與檢討、相似題、錯題分析 |
  | 筆記與圖片 | `notes/` | 使用者筆記、圖片上傳、圖片牆（含圖片放大） |
  | 網站外框 | `shell/` | 側欄、主題切換 |
  | 設定 | `settings/` | 設定面板、字級 |
  | 每日練習 | `practice/` | 每日練習底下各頁共用的元件（作答時間、詳解、返回框架） |
  | 統計分析 | `resources/` | 統計分析底下各頁的元件（趨勢分析、速記圖庫） |

### Layouts：照網站實際畫面組起來的版面

- 由多個 Components 組合成網站上實際看到的畫面，例如選擇題練習答錯後的作答畫面：
  題目、選項、答錯提示、詳解、使用者筆記、底部導覽。
- 每個網站上用到的畫面都要有。故事要能像網站一樣操作（作答、換題、切換、展開），
  操作不到的狀態（空白、載入中、載入失敗……）才另外寫故事，見下方「什麼時候拆成另一個故事」。
- 一定要用網站實際的頁面或 features 元件組合，不可以在故事裡另外刻一份 HTML／CSS，
  這樣調整網站的程式時，故事會跟著一起變。
- 標題：`Layouts/<頂部列顯示的頁面名稱>/<畫面>`，例如 `Layouts/選擇題練習/作答畫面`；
  總覽頁的畫面叫「總覽」。例外：側欄與頂部列本身（含設定視窗、手機選單）放在
  `Layouts/網站外框/`，管理頁放在 `Layouts/管理/`。
- 檔案放在 `src/stories/layouts/<頁面資料夾>/`。
- meta 照網站的組合方式加 decorators，第一個最靠近故事、最後一個在最外層：
  `decorators: [<頁面外層，例如 PracticeLayout>, withPageFrame]`，parameters 一律寫成
  `parameters: { ...pageParameters('/網址') }`（meta 有 JSDoc 註解時，直接寫函式呼叫的
  parameters 會被 Storybook 蓋掉）。`withPageFrame` 會放進網站的側欄與頂部列，工具列的
  「外框」可以隱藏側欄。
- 只畫頁面裡的某一段（例如 PracticePage 的作答畫面）時，也要保留頁面最外層的元素：
  很多頁面的手機版排版靠最外層的 container query，少了它手機版會跑版。

## 什麼時候拆成另一個故事

故事越少越好讀。在同一個故事畫面上能手動操作看到的狀態，就不要另外拆成故事：

- 畫面上點得到的：切換科目或年度、換題、作答、展開／收合、開啟對話框或選單、切換分頁、
  輸入文字。例如難題清單「切換到其他科目」「切換到其他年度」都在同一個故事裡點。
- 工具列切得到的：主題（淺色／深色）、外框、雲端同步、手機／平板寬度（viewport）。
  不另外寫手機版、深色版、登入版的故事。
- 元件的 props：用 Controls 調整，不要一個值一個故事。要切換範例資料時，在 `argTypes`
  用 `options` 加 `mapping` 做成選單；需要並排比較時（例如按鈕的所有樣式）用一個故事並排。
  選項名稱是中文時，Controls 可以選，但選擇不會記在網址裡；需要用網址分享某個選擇時，
  選項名稱改用英文、數字，中文寫在 `control: { labels }`。

只有操作不到的狀態才拆成另一個故事，例如不同的存檔資料（沒有資料／有資料／資料很多、
有詳解與筆記）、載入中、載入失敗、找不到資料、儲存空間已滿。

- 故事的初始畫面選資料最完整、最常需要調整的狀態（例如作答畫面從答錯的那一題開始，
  按「下一題」就能看到未作答的題目），其他狀態從這裡點過去。
- meta 的 JSDoc 寫出「畫面上可以操作看到」哪些狀態，讓人知道要點哪裡。
- 不寫 `play` 函式來點出狀態。

## 撰寫方式

- 故事名稱用中文描述狀態或資料，直接當 export 名稱，例如 `export const 作答中: Story`。
- 每個故事開始前，瀏覽器裡的網站資料都會清空，再換成這個故事的設定
  （`support/story-environment.tsx`）：
  - `parameters.appState`：本機作答資料，例如答題、難題、筆記、筆記圖片、作答紀錄、字級。
  - `parameters.localStorage`／`parameters.sessionStorage`：其他存檔，例如練習進度。
  - `parameters.fetchMocks`：網站 API（`/api/...`）的假回應。要依輸入決定結果時（例如檢查
    金鑰、回傳剛存的資料）用 `respond`，故事裡輸入不同內容就看得到不同結果，不用為每種
    回應各寫一個故事（見 `fixtures/admin.ts`）。
  - 故事的 parameters 會跟 meta 的合併，不會整個換掉：故事拿不掉 meta 設定的資料或網址
    參數，所以只有每個故事都要的資料才放 meta。
- 題庫一律用 `fixtures/questions.ts` 的範例題庫（從實際題庫複製的法規 101、113、114 年，
  環控、構造、結構 113 年）。照抄頁面的 `getStaticProps` 時用 `fixtureSubjectQuestions`，
  順序跟伺服器一樣。網站會快取題庫請求，所以不能在單一故事裡換題庫或讓題庫載入失敗；
  要看「載入中」「載入失敗」就用元件本身的 props。
- 共用的範例資料放在 `fixtures/`，日期用 `FIXTURE_NOW` 之類的固定值，不要用目前時間，
  畫面才不會每次打開都不一樣。
- 頁面用網址參數換畫面（`router.push`／`replace`）時，decorators 加上
  `support/stateful-router.tsx` 的 `withStatefulRouter`（放在 `withPageFrame` 前面），
  故事裡點題號、切換科目才會真的換畫面。
- 不可以 import `src/server` 或有 `getStaticProps` 的 `src/pages` 頁面（瀏覽器裡跑不了伺服器
  程式）；改用頁面裡的 features 元件，props 用範例資料準備，算法照頁面的
  `getStaticProps`。沒有伺服器程式的頁面可以直接 import。
- 工具列：
  - 「主題」切換淺色／深色。
  - 「外框」顯示或隱藏網站的側欄與頂部列（只影響 Layouts）。
  - 「雲端同步」切換登入狀態（`support/cloud-sync.ts`）。預設是沒有設定雲端的本機版；
    正式網站有設定雲端，要看正式網站頂部列的「同步作答」或問題回報的 Google 登入就切到
    雲端狀態。
  - 視窗寬度（viewport）切換手機、平板、筆電、桌機。只在某種寬度才出現的元件（例如只在
    手機出現的抽屜選單按鈕、只在桌機出現的側欄）可以在 meta 設
    `globals: { viewport: { value: 'mobile' } }` 之類的預設寬度。
- Storybook 不會連到 Firebase：「雲端同步」只換掉畫面上的登入狀態，共享投稿在雲端狀態下
  會一直顯示載入中，也送不出去。
- 看不到的狀態：瀏覽器原生的 `window.confirm`、網站讀取本機資料前一瞬間的「正在讀取…」
  畫面。不用為了這些改網站程式。

## 維護

- 新增或修改網站的元件、畫面時，同時新增或更新對應的故事。
- 改完執行 `npm run typecheck`、`npm run lint`，並打開 Storybook 確認故事都能正常顯示。
