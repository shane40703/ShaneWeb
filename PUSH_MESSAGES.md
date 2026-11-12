# 站內即時公告操作

公告只在網站開啟時顯示，不是手機系統通知，不需要通知權限或登入。

## 首次上線

先部署規則和索引，再部署網站。這次程式修改不會自動發布 Firebase 規則。

```sh
firebase deploy --only firestore:rules,firestore:indexes --project shaneweb
```

若 Console 已有其他複合索引，保留它們；不要答應刪除不在本機檔案內的既有索引。等待新增的 `pushMessages` 索引狀態為 Enabled 後再測試。

確認 Vercel 使用既有 Firebase 環境變數，不需要新增金鑰。GA 則使用既有 `NEXT_PUBLIC_GA_MEASUREMENT_ID`。

## 發一則公告

Firebase Console → Firestore Database → 資料 → 建立集合 `pushMessages`，新增自動 ID 文件，填以下三欄：

| 欄位 | Firebase 型別 | 內容 |
| --- | --- | --- |
| `message` | string | 公告文字，可換行，1～2000 字元；不支援 HTML |
| `expiresAt` | timestamp | 未來的到期時間；注意 Console 顯示的時區，不要填字串 |
| `status` | string | 先填 `test`，確認後改 `live`；大小寫須一致 |

1. 開啟 `https://exam-tw.vercel.app/?push_test=1`，角落會出現「測試模式」。
2. 保持頁面在前景，新增 `test` 文件；右下方會出現公告，按「已讀」後不再顯示。
3. 確認文字、期限和手機顯示，將同一文件的 `status` 改成 `live`。正式訪客就會收到，作者也能再收到一次正式版本。
4. 完成測試後開啟 `https://exam-tw.vercel.app/?push_test=0` 關閉。開關保存在目前瀏覽器，不同瀏覽器各自設定。

未填／錯填 `status`、空白文字、無效／過期時間均不顯示。正式模式的監聽查詢只包含 `live`；測試模式包含 `test`、`live`。想撤下可將到期時間改成過去，或刪除文件。

**測試開關不是作者驗證**：知道網址的人都能開啟，測試訊息不能放機密。規則禁止訪客新增、編輯或刪除公告；作者從 Console 操作依 IAM 權限。

## 已讀與統計

文件會自動出現四個數字，不必手動建立：

| 欄位 | 意義 |
| --- | --- |
| `testDelivered` / `testRead` | 測試版本顯示／已讀人次 |
| `delivered` / `read` | 正式版本顯示／已讀人次 |

「人次」定義：同一瀏覽器、同一文件 ID、同一個 test/live 階段各計一次。公告實際渲染於前景頁面才回報顯示；按「已讀」才回報已讀。到期或作者撤下不算已讀。多則公告逐則顯示，不會把還沒顯示的排隊訊息算進去。

- 文件底下 `receipts` 子集合保存隨機瀏覽器代碼及階段、顯示、已讀狀態，交易同時更新主文件計數。`lastReceiptId` 是規則驗證欄位，不要手改。
- 重新整理、重連和多分頁交易會去重。改同一文件的文字或延長期限不重設已讀；要發新公告請新增文件。
- 測試與正式的本機已讀鍵、雲端 receipt 完全分開。別將已發布文件來回切換狀態當作新公告。
- 已讀先保存在本機；斷線時不阻擋作答，連線恢復／回到頁面／每 30 秒重試。若重試時已過期、撤下或換階段，可能無法補計；不追補不存在的曝光。
- 清除網站資料、換裝置、不同網域／瀏覽器會算新的人次；儲存被禁止時只能保留本次頁面狀態。這不是精準的不重複自然人統計。
- 公開匿名回報不是防灌票：規則限制每個隨機代碼只能增加一次，不能防止惡意產生新代碼。需要防濫用時另加 App Check／可信後端限流；不要把數字作為付款或安全依據。
- 公告與總數可公開讀取，receipt 不可列舉，也不連結 Google 帳號。所有訪客監聽同一公告，計數更新會造成讀取，熱門公告也可能有單文件寫入競爭；注意 Firebase 用量與預算警示。
- 清理公告時注意 Firestore 刪父文件不會連帶刪除子集合。確認不需保留數據後，再由管理者清理 receipts；不要只清零計數卻保留 receipts。

## GA4

所有公告共用 `push_delivered`、`push_read` 兩個事件，以 GA 的「事件計數」加總，不建立每則公告專屬事件或自訂人次變數。不傳公告 ID、文字或瀏覽器代碼。

只有新回報成功的瀏覽器會送 GA 事件。測試事件帶事件層級 `debug_mode: true`；正式事件不帶此參數（即使目前瀏覽器開著測試模式）。GA 停用、阻擋器、網路中斷或頁面在回報前關閉可能使 GA 與 Firestore 數字不同。

要防止測試進正式報表，**作者需在 GA4 另行設定**：

1. 管理 → 資料收集與修改 → 資料篩選器 → 建立「開發人員流量」篩選器，選擇排除。
2. 先設 Testing，打開 DebugView，以 `test` 公告確認兩種事件及 `debug_mode`。
3. 確認後將篩選器設 Active。排除只影響啟用後的資料，啟用前先檢查，正式排除不能事後取回。

單靠前端 `debug_mode` 不等於已啟用資料篩選器。`?ga=off` 的瀏覽器不送任何 GA 事件，測試時如需恢復用 `?ga=on&push_test=1`。

參考：[GA4 開發人員流量](https://support.google.com/analytics/answer/13296662)、[DebugView](https://support.google.com/analytics/answer/7201382)、[Firestore 原子交易](https://firebase.google.com/docs/firestore/manage-data/transactions)、[Base UI Toast](https://base-ui.com/react/components/toast)。

## 開發驗證

```sh
npm run typecheck
npx vitest run src/lib/push-messages.test.ts src/components/push-messages.test.tsx src/lib/analytics.test.ts
# 需要 Firebase CLI 與 Java 21，只使用 demo 專案及 127.0.0.1:8089
npm run test:push-rules
```

Storybook：`Components/基礎 UI/PushMessageToast`，使用示範文字、不連 Firebase。部署後仍需以兩個瀏覽器實測：一般模式不能收到 test；test → live 兩邊均能收到；已讀重整不重複；到期自動消失；GA DebugView 與 Console 計數各自正確。
