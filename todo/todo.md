# Todo

已完成的需求請見[歷史紀錄](歷史紀錄/todo-歷史紀錄.md)。
尚待確認的需求請見[待討論](待討論/todo-待討論.md)。

## 1.102 - 2026-11-03

狀態：已實作待審核

![alt text](image-18.png) ![alt text](image-19.png)在考古題討論版、每日抽題練習看完答案、歷屆試題模擬考交卷後、難題標記、常錯題目，新增可以複製題目內容(含選項)為文字的選項，方便使用者複製，有圖片的題目可以忽略圖片
![alt text](image-20.png) 所有題目的圖片都改為無法另存
![alt text](image-21.png) 繼續作答直接開始該年度，不是連結到選科目選年度的頁面
![alt text](image-22.png) 每日練習履歷不用有收起展開，直接列出即可
![alt text](image-23.png) 每日抽題練習的這些字隱藏

實作說明：複製題幹及畫面上的選項順序，不含圖片或原選項提示；每日練習須先看答案。題目圖片與放大圖阻擋右鍵、拖曳及手機長按選單，但無法阻止截圖或其他方式取得圖片。續作保留既有草稿；每日履歷分組直接展開。紙本字型改用替代字型時仍會提示。

## 1.103 - 2026-11-02

狀態：未實作

原始需求：把需要做還沒做的手動操作放到 1.103。

以下都由網站管理者在 Threads、各服務後台或手機上手動完成，不需要改程式。由上到下照順序做，內容是 2026-11-02 最新版部署完成後查到的狀態。

### Threads

- [x] 如果貼文或自介用了 `https://exam-tw.vercel.app/threads`，要換掉，這個網址已經打不開了。
  - 自介：`https://exam-tw.vercel.app/?utm_source=threads&utm_medium=social&utm_campaign=launch&utm_content=bio`
  - 留言：`https://exam-tw.vercel.app/?utm_source=threads&utm_medium=social&utm_campaign=launch&utm_content=comment`
- [x] 用 Threads App 點一次自介和留言的連結，確認能打開網站。進站後網址列會自動拿掉後面的參數，這是正常的，來源要隔天才看得到。

### Google Search Console

- [x] 新增「網址前置字元」資源 `https://exam-tw.vercel.app/`，驗證方式選 HTML 標記，複製 `content` 的值。先不要按驗證。
- [x] 到 Vercel 新增 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`，值是上一步的內容，只勾 Production。
- [x] 到 Vercel 的 Deployments，對最新一筆按 Redeploy。這個設定要重新部署才會生效，目前正式網站還沒有。
- [x] 部署完成後回到 Search Console 按驗證。
- [x] 到 Sitemaps 提交 `sitemap.xml`。
- [x] 到 URL Inspection，對首頁、`/exams` 和幾份試卷（例如 `/exams/law/114`）按 Request indexing。
- [x] 到 Google Analytics 的 Admin > Product links 連結 Search Console。

### Google Analytics

- [x] 到考古題討論版選答案、按「看解答」，確認 Realtime 的 Event count by Event name 出現 `question_answered`。
- [x] 把 `question_answered` 設成重要事件：到 Admin > Events 的 Recent events 點它旁邊的星號，計算方式改成 Once per session。清單最多要等 24 小時才會出現，目前重要事件只有預設的 `purchase`。
- [x] 到 Admin > Data retention 確認 Event data 是 14 個月，並按過 Save。
- [x] 手機和電腦常用的瀏覽器各開一次 `https://exam-tw.vercel.app/?ga=off`，排除自己的使用紀錄。要等上面的 `question_answered` 確認完才做。

### 手機實測加入主畫面

- [ ] iPhone：點手機選單的「加入主畫面」，照三步加入，確認能走到「打開為網頁 App」開關，從圖示打開後作答紀錄還在。
- [ ] Android：用 Chrome 點「加入主畫面」，確認跳出安裝視窗，安裝後能從主畫面打開。

### 審核

- [x] 讀一次「隱私權政策」頁，這是對外公開的文字。

### 隔天以後

- [x] 到 Traffic acquisition 確認有 `threads / social`，有就代表 Threads 保留了連結後面的參數。
- [ ] 比較自介和留言的連結各帶來多少人：
  - 只看點擊次數：到 Threads App 的洞察報告看各連結被點了幾次。
  - 看點進來的人有沒有留下來：到 Google Analytics 的 Explore 開 Free form，Rows 只放 Session manual ad content，Values 放 Sessions 和 Engaged sessions，篩選 Session source / medium 包含 `threads`，日期選 Last 28 days，再把這頁加入書籤。`bio` 和 `link_in_bio` 都算自介，`comment` 是留言。
- [ ] 到 Explore 建表，篩選 `question_answered`，列放 `practice_area` 或 `practice_mode`，值放活躍使用者和事件數。

### Google 登入（1.104）

- [x] 1.104 推上去之前：到 Google Cloud Console 的 APIs & Services > Credentials，打開 OAuth 2.0 Client「Web client (auto created by Google Service)」，在 Authorized redirect URIs 加上 `https://exam-tw.vercel.app/__/auth/handler` 和 `https://shane-web.vercel.app/__/auth/handler` 兩筆，按 Save。舊網址 shane-web.vercel.app 也開得到本站，少了那一筆，從那裡按「同步作答」會停在 Google 的錯誤頁。存檔後可能要等幾分鐘才生效。
- [x] 1.104 上線後，用電腦和 iPhone 各按一次「同步作答」，iPhone 也要從主畫面打開的 App 試一次。確認登入完會回到原本那一頁並開始同步；在 Google 畫面按返回或左上角 ✕，按鈕要恢復成「同步作答」。

## 1.104 - 2026-11-03

狀態：已實作待審核

原始需求：我想要全面移除登入彈出視窗

- [x] 按「同步作答」不再跳出 Google 登入小視窗，整個頁面會換到 Google 登入畫面，登入完自動回到原本那一頁。
- [x] 從主畫面打開的 iPhone App 裡也能登入，不會再出現「請用 Safari 打開本站再登入」。
- [x] 在 Google 登入畫面按返回或左上角 ✕ 取消，會回到原本那一頁，按鈕恢復成「同步作答」。
- [x] 從 Google 回來、網站還在確認登入時，按鈕顯示「登入中」。

使用方式：點右上角的「同步作答」（手機是雲朵圖示），在 Google 畫面選帳號，回到原本那一頁後就開始同步。

### ai agent 實作時的決定

- 上線前要先在 Google Cloud Console 加登入完要回來的網址，本站兩個網址各一筆，步驟寫在 1.103。沒加就推上去的話，所有人按「同步作答」都會停在 Google 的錯誤頁。
- Google 選帳號的畫面還是在 Google；登入前後經過的 Firebase 中繼頁改放在本站網址下，由網站在背後轉給 Firebase。中繼頁放在 Firebase 的網址時，瀏覽器會擋掉從 Google 帶回來的登入結果，回來後還是沒登入。附帶的改變是 Google 選帳號畫面上顯示的網站會從 shaneweb.firebaseapp.com 變成本站網址。
- iPhone 加入主畫面的步驟沒有改，還是請用戶關閉「打開為網頁 App」。主畫面 App 的資料和 Safari 分開，登入後同步的資料會回來，但沒登入時存的作答紀錄在 App 裡看不到。
