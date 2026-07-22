# 建築師考試考古題平台－新版實作紀錄

本次實作依照使用者提供的「建築師考試考古題平台－介面與功能調整需求」完成。專案已全面改用 Next.js Pages Router，未使用 App Router 或 React Server Components。

## 完成項目

- [x] 建立 `/`、`/papers`、`/quiz`、`/random`、`/analysis`、`/community`、`/notes`、`/difficult`、`/history` 獨立 routes。
- [x] 移除 `src/app` 下所有 App Router routes、`/settings`、設定導覽與介面偏好狀態。
- [x] 首頁只保留四科大型入口卡片。
- [x] 歷屆試題頁提供科目選擇、102–114 年列表與每年開始作答連結。
- [x] 作答頁自動計時，支援選答、上一題／下一題、交卷結果、錯題列表與總作答時間。
- [x] 隨機出題改為獨立 `/random` route，組卷後導向 `/quiz`。
- [x] 考題分析只使用題庫的 `primaryCategory`，提供單年度／跨年度、圓餅圖、長條圖與表格。
- [x] 詳解與匿名討論提供科目、年份、題號選擇、前後題、返回作答、投稿、按讚、回覆與檢舉。
- [x] 難題按鈕統一為燈泡 Icon 加文字，並在作答、結果、詳解及難題頁使用。
- [x] 筆記、難題、作答紀錄與本機匿名討論保存於 `localStorage`。
- [x] localStorage 升級為 v3，並可遷移既有 v2 的作答與難題資料，舊介面偏好不再保留。
- [x] 桌面與手機響應式版面完成。

# Post Implementation

## Remaining TODOs (if any)

- [ ] 補入可信且授權的完整真題資料。目前原專案只有 20 題，未涵蓋四科的民國 102–114 年全部試卷；缺資料的科目／年度會顯示「題庫資料待補」，不會把示範資料宣稱為完整真題。
- [ ] 若未來要做真正跨使用者的匿名社群，需新增後端 API、資料庫與檢舉審核流程；目前討論內容依初版無帳號需求只保存在本機。

## How to Test

1. 執行 `npm run typecheck`。
2. 執行 `npm run lint`。
3. 執行 `npm test`，驗證題庫、分析、localStorage v3 與 reducer。
4. 執行 `npm run test:e2e`，驗證桌面／手機 routes、作答、計時、難題、分析、討論、筆記、歷史與 `/settings` 404。
5. 執行 `npm run build`，確認 production build 只列出 `Route (pages)`，所有產品頁皆為靜態 Pages Router route。
