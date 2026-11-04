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

## 1.105 - 2026-11-03

狀態：未實作

原始需求：過幾天去 search console 檢查 index 情況

以下由網站管理者在 Search Console 手動檢查，不需要改程式。11 月 3 日已提交 sitemap（共 3,749 頁），也對 6 個網址按過 Request indexing。新網站收錄得慢，11 月 6 日以後再看。

- [ ] 到左邊的 Indexing > Pages，看 Indexed 和 Not indexed 各有幾頁。
- [ ] 在同一頁的 Why pages aren't indexed 看沒收錄的原因：
  - Discovered - currently not indexed、Crawled - currently not indexed：Google 還沒排到，先等。過兩三週大部分還停在這裡，再截圖給 ai agent 看。
  - Blocked by robots.txt：難題標記、常錯題目、設定這類個人頁面本來就不讓 Google 收錄，正常。
  - Alternate page with proper canonical tag、Page with redirect：同一頁的另一個網址，例如後面帶參數的連結，正常。
  - 其他原因截圖給 ai agent 看。
- [ ] 到最上面的 URL Inspection 查 11 月 3 日送過的 6 個網址，看是不是變成 URL is on Google：
  - `https://exam-tw.vercel.app/`
  - `https://exam-tw.vercel.app/exams`
  - `https://exam-tw.vercel.app/exams/law/114`
  - `https://exam-tw.vercel.app/exams/env/114`
  - `https://exam-tw.vercel.app/exams/construction/114`
  - `https://exam-tw.vercel.app/exams/structure/114`
- [ ] 到 Performance 看 Total clicks 和 Total impressions 有沒有開始出現，以及別人搜尋哪些字找到本站。


## 1.106 - 2026-11-04

狀態：已實作待審核

![alt text](image.png) 這個區塊讓字無法選取(不可反白)
![alt text](image-1.png) 這個區塊讓字無法選取(不可反白)，連帶設定內都一樣
![alt text](image-2.png) ![alt text](image-3.png)討論版、考古題選擇、每日練習、法規克漏字選擇葉面讓字無法選取(不可反白)

實作說明：指定的社群區塊、設定視窗與設定頁、科目年度選擇及練習設定區不反白；另處理側欄、頁面標題與首頁／功能入口卡片。題目、條文、詳解、筆記與輸入欄位維持原有選取及編輯功能。

#1.107
![alt text](image-4.png) 

## 1.108 - 2026-11-04

狀態：已實作待審核

原始需求：你之前加入鍵盤答題 但是操作很不直觀 改成上下用來選擇選項 左右切換下一題上一題

- [x] 歷屆試題模擬考作答時，用上下方向鍵選答案：按下鍵移到下一個選項，按上鍵移到上一個選項。
- [x] 用左右方向鍵換題：左鍵上一題，右鍵下一題。
- [x] 數字鍵 1～4 和 N、P 不再有作用。
- [x] 電腦版作答時間旁的按鍵提示改成「↑↓ 選答案・←→ 換題」。

使用方式：在模擬考作答時按上下鍵選答案，再按右鍵到下一題。

### ai agent 實作時的決定

- 還沒作答時，按下鍵從 A 開始，按上鍵從最後一個選項開始。
- 到第一個或最後一個選項就停住，不會從 D 繞回 A：多按一下不會把答案改到另一端。
- 刪去的選項會直接跳過。
- 按住方向鍵不放只移動一格；在試卷裡按方向鍵不會捲動頁面。
- 在最後一題按右鍵不會交卷，交卷一定要按按鈕。
- 數字鍵和 N、P 拿掉，不和方向鍵並存：同一件事只留一種按法，提示也比較短。
- 按著 Alt、Ctrl、⌘ 或 Shift 的方向鍵留給瀏覽器，例如 Alt＋左鍵是回上一頁。
- 只改歷屆試題模擬考：每日抽題練習、考古題討論版、常錯題目、難題標記本來就沒有鍵盤換題。
