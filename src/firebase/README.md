# Firebase 作答紀錄同步設定

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
firebase deploy --only firestore:rules
```

也可以把根目錄 `firestore.rules` 的內容貼到 Firebase Console 的 Firestore Rules 並發布。

## 4. 設定網域

- 在 Authentication > Settings > Authorized domains 加入正式網站網域。
- 在 Vercel 專案的 Environment Variables 加入與 `.env.local` 相同的六個變數，然後重新部署。

## 第一階段同步範圍

- 未登入：繼續保存於目前瀏覽器。
- 第一次 Google 登入：合併本機與 Firestore 的歷屆試卷作答紀錄，依 `attempt.id` 去除重複。
- 登入後完成新試卷：保留本機資料並上傳 Firestore。
- 隨機出題紀錄原本就不保存，因此不會同步。
- 筆記、難題、閱讀設定與配色尚未納入第一階段。

## 共享詳解與討論

- 所有人都能即時讀取公開投稿與回覆。
- Google 登入後才能投稿、回覆、按讚或檢舉。
- 投稿與回覆以匿名名稱顯示，但 Firestore 會保存 Firebase UID 以驗證作者權限。
- 作者可以刪除自己的投稿或回覆；投稿使用軟刪除，避免遺留的子集合被錯誤顯示。
- 每篇投稿最多 5,000 字、每則回覆最多 2,000 字，限制由 Firestore Rules 強制執行。
- 目前共享投稿只支援文字。圖片應在後續版本上傳至 Firebase Storage，Firestore 僅保存檔案路徑，請勿把 Base64 圖片寫入 Firestore。
- Firebase 未設定時，開發環境仍會使用既有的本機投稿備援。
