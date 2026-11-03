# Firebase 作答紀錄與筆記同步設定

網站沒有 Firebase 設定時會維持原本的免登入、本機保存。完成下列設定後，頂部會出現「同步作答」按鈕。

## 1. 建立 Firebase 專案

1. 在 Firebase Console 建立專案。
2. 新增 Web App，不需要啟用 Firebase Hosting。
3. 在 Authentication 的 Sign-in method 啟用 Google。
4. 建立 Cloud Firestore Standard edition 資料庫；正式環境不要使用允許所有人存取的測試規則。

## 2. 設定本機環境變數

複製根目錄的 `.env.example` 為 `.env.local`，填入 Firebase Web App 顯示的設定值：

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

這些 Firebase Web 設定值不是管理員密鑰，會出現在瀏覽器程式碼中。私人作答資料由 `firestore.rules` 限制為只有相同 Firebase UID 可以存取；共享討論則允許公開讀取，但只有登入者可以投稿或互動。

## 3. 發布 Firestore Rules

安裝並登入 Firebase CLI 後執行：

```powershell
firebase use --add
firebase deploy --only firestore:rules,storage
```

也可以把根目錄 `firestore.rules` 的內容貼到 Firebase Console 的 Firestore Rules 並發布。
每次修改 `firestore.rules` 都要重新發布；例如選擇題練習的作答紀錄（`mode: 'practice'`）要等新規則發布後才會上傳，在那之前只保存在本機。
若使用詳解圖片，還需將根目錄 `storage.rules` 貼到 Firebase Console 的 Storage Rules 並發布。

## 4. 設定網域

- 在 Authentication > Settings > Authorized domains 加入正式網站網域。
- 在 Vercel 專案的 Environment Variables 加入與 `.env.local` 相同的六個變數，然後重新部署。
- 在 Google Cloud Console 的 APIs & Services > Credentials，打開 OAuth 2.0 Client「Web client (auto created by Google Service)」，在 Authorized redirect URIs 加入 `https://<正式網站網域>/__/auth/handler`。換網域時也要加新的一筆；沒加的話，按「同步作答」會停在 Google 的 `redirect_uri_mismatch` 錯誤頁。

### Google 登入的方式

- 登入不開彈出視窗，整個頁面轉到 Google，登入完回到原本那一頁。iPhone 主畫面 App 的彈出視窗關掉時網站無從得知，按鈕會一直停在「登入中」，所以全站改用轉導。
- 轉導回來後，Firebase 要從它的登入頁讀結果。登入頁若在 `firebaseapp.com`，就是嵌在本站裡的第三方頁面，Safari、Chrome 都會把它的儲存空間隔開，結果會遺失。所以網站在 https 下把自己的網域當成 `authDomain`（`resolveFirebaseAuthDomain`），`next.config.ts` 再把 `/__/auth/` 轉給 `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`。這個變數要維持 `<project>.firebaseapp.com`，改成本站網域會變成轉給自己。
- 本機用 http 開發時，Firebase 只能組出 https 的登入頁網址，所以仍用 `firebaseapp.com`，轉導回來不會登入。要在本機測登入，需改用 https，並把本機的 `/__/auth/handler` 網址也加進 Authorized redirect URIs。

## 同步範圍

- 未登入：繼續保存於目前瀏覽器。
- 第一次 Google 登入：合併本機與 Firestore 的作答紀錄（歷屆試題模擬考與選擇題練習），依 `attempt.id` 去除重複。
- 登入後交卷：保留本機資料並上傳 Firestore；伺服器拒絕的紀錄會留在本機，不會被當成其他裝置刪除。
- 文字筆記依每題的 `updatedAt` 合併，較新的新增、修改或刪除會同步至其他登入裝置。
- 筆記圖片目前仍只保存在本機；Data URL 不寫入 Firestore，以免超過文件大小限制。
- 舊版隨機出題的紀錄原本就不保存，因此不會同步。
- 難題標記以登入帳號的完整題號清單同步。
- 題目與選項字體大小、淺色／深色模式及自訂配色會跟隨登入帳號同步；帳號已有雲端設定時，以雲端版本套用到新裝置。
- 「常錯題目」依歷屆試題模擬考與選擇題練習的交卷紀錄逐次累計，稍後答對不會刪除過去的答錯次數。

## 共享詳解與討論

- 所有人都能即時讀取公開投稿與回覆。
- Google 登入後才能投稿、回覆、按讚或檢舉。
- 投稿與回覆以匿名名稱顯示，但 Firestore 會保存 Firebase UID 以驗證作者權限。
- 作者可以刪除自己的投稿或回覆；投稿使用軟刪除，避免遺留的子集合被錯誤顯示。
- 每篇投稿最多 5,000 字、每則回覆最多 2,000 字，限制由 Firestore Rules 強制執行。
- 目前共享投稿只支援文字。圖片應在後續版本上傳至 Firebase Storage，Firestore 僅保存檔案路徑，請勿把 Base64 圖片寫入 Firestore。
- Firebase 未設定時，開發環境仍會使用既有的本機投稿備援。

## 社群連結與歷史回報

- 問題回報表單已改為 `/community` 社群連結頁；舊 `/report` 網址會重新導向，不再送出回報。
- 社群頁不需要登入、不寫入 Firestore；Threads 連結與本機 QR Code 指向同一個公開主頁。
- 既有 `contentReports` 雲端資料、本機舊回報及其管理介面保留，不因移除表單而刪除使用者資料。
- 這次不變更 Firestore Rules；歷史雲端回報仍可由有權限的管理者在 Firebase Console 查看。

## 使用統計（Google Analytics）

- 只在 Vercel 的 Production 設定 `NEXT_PUBLIC_GA_MEASUREMENT_ID`；沒有這個變數時網站不會載入 GA，本機與 Preview 都不會送資料。
- 程式直接使用 gtag，不經過 `firebase/analytics`；評估 ID 來自連結到 Firebase 專案的 GA4 資源（G- 開頭）。所有呼叫都集中在 `src/lib/analytics.ts`。
- 每個頁面只傳路徑和 `utm_` 參數，`?question=`、`?q=`、`?result=` 不會送出，整頁載入時來自本站的 referrer 也會先清理；同一頁換題不算新的頁面瀏覽。考古題討論版每題有自己的網址，但 GA 一律記成 `/exams` 和固定標題，所以統計資料不含題號。每題的搜尋成效看 Search Console。gtag.js 抽樣送出的診斷請求（`/td`、`/a`）會帶載入時的網域和路徑，無法用設定關閉，隱私權政策有說明。
- 社群貼文都連到首頁並帶 `utm_` 參數。第一筆頁面瀏覽記下來源後，`src/components/analytics.tsx` 會把首頁網址列的這些參數拿掉，複製網址分享時才不會把來源一起帶走。其他頁面不處理：每日抽題練習會把網址變動當成使用者操作，重設選好的科目。

| 事件 | 送出時機 |
| --- | --- |
| `practice_start` | 開始一組練習或一份試卷；法規克漏字在本輪第一次提交或看答案時 |
| `question_answered` | 確認答案、模擬考第一次選答、考古題討論版選答後看解答 |
| `answer_revealed` | 沒有作答就看答案（含申論題） |
| `practice_complete` | 完成練習、交卷、法規克漏字的最後一題 |
| `paper_download` | 紙本練習卷的 PDF 下載成功 |

| 參數 | 值 |
| --- | --- |
| `practice_area` | `daily`、`exams`、`review` |
| `practice_mode` | `daily_quiz`、`mock_exam`、`law_cloze`、`paper`、`exams`、`wrong_retry`、`difficult_retry` |
| `subject` | 科目 ID |

- 用網址的 `?ga=off` 可以讓目前瀏覽器不再送出統計（例如作者自己的瀏覽器），設定會記住（還沒設定評估 ID 時也一樣），之後用 `?ga=on` 恢復。
- Google Search Console 用「HTML 標記」驗證：把標記 `content` 的值設成 Vercel Production 的 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`，重新部署後驗證。`vercel.app` 網域無法用 DNS 驗證，GA 代碼也不在 `<head>` 內，所以不能用這兩種方式。
- GA4 資料串流的「加強型評估」（Enhanced measurement）必須保持關閉：網站自己送頁面瀏覽，開著會重複計算；而且 `?q=` 是題號，會被當成站內搜尋事件。
