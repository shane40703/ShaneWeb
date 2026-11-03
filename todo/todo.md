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

- [ ] 如果貼文或自介用了 `https://exam-tw.vercel.app/threads`，要換掉，這個網址已經打不開了。
  - 自介：`https://exam-tw.vercel.app/?utm_source=threads&utm_medium=social&utm_campaign=launch&utm_content=bio`
  - 留言：`https://exam-tw.vercel.app/?utm_source=threads&utm_medium=social&utm_campaign=launch&utm_content=comment`
- [ ] 用 Threads App 點一次自介和留言的連結，確認能打開網站。進站後網址列會自動拿掉後面的參數，這是正常的，來源要隔天才看得到。

### Google Search Console

- [ ] 新增「網址前置字元」資源 `https://exam-tw.vercel.app/`，驗證方式選 HTML 標記，複製 `content` 的值。先不要按驗證。
- [ ] 到 Vercel 新增 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`，值是上一步的內容，只勾 Production。
- [ ] 到 Vercel 的 Deployments，對最新一筆按 Redeploy。這個設定要重新部署才會生效，目前正式網站還沒有。
- [ ] 部署完成後回到 Search Console 按驗證。
- [ ] 到 Sitemaps 提交 `sitemap.xml`。
- [ ] 到 URL Inspection，對首頁、`/exams` 和幾份試卷（例如 `/exams/law/114`）按 Request indexing。
- [ ] 到 Google Analytics 的 Admin > Product links 連結 Search Console。

### Google Analytics

- [ ] 到考古題討論版選答案、按「看解答」，確認 Realtime 的 Event count by Event name 出現 `question_answered`。
- [ ] 把 `question_answered` 設成重要事件：到 Admin > Events 的 Recent events 點它旁邊的星號，計算方式改成 Once per session。清單最多要等 24 小時才會出現，目前重要事件只有預設的 `purchase`。
- [ ] 到 Admin > Data retention 確認 Event data 是 14 個月，並按過 Save。
- [ ] 手機和電腦常用的瀏覽器各開一次 `https://exam-tw.vercel.app/?ga=off`，排除自己的使用紀錄。要等上面的 `question_answered` 確認完才做。

### 手機實測加入主畫面

- [ ] iPhone：點手機選單的「加入主畫面」，照三步加入，確認能走到「打開為網頁 App」開關，從圖示打開後作答紀錄還在。
- [ ] Android：用 Chrome 點「加入主畫面」，確認跳出安裝視窗，安裝後能從主畫面打開。

### 審核

- [ ] 讀一次「隱私權政策」頁，這是對外公開的文字。
- [ ] 審核 1.99、1.100、1.101，這三項都還是已實作待審核。

### 隔天以後

- [ ] 到 Traffic acquisition 確認有 `threads / social`，有就代表 Threads 保留了連結後面的參數。
- [ ] 到 Acquisition > Overview > View Manual campaigns，維度換成 Session manual ad content，比較自介 `bio` 和留言 `comment`。
- [ ] 到 Explore 建表，篩選 `question_answered`，列放 `practice_area` 或 `practice_mode`，值放活躍使用者和事件數。
