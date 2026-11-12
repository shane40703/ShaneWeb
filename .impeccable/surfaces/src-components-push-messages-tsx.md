---
version: 1
slug: "src-components-push-messages-tsx"
primary_target: "src/components/push-messages.tsx"
related_targets: []
---

## Scope
站內公告，附加在現有作答網站；作者以 Firebase Console 管理，未登入也能接收。僅支援頁面開啟期間，不是系統背景推播。

## Direction contract
THESIS: 安靜的網站公告，不遮住整張試卷、不使用強制對話框。

OWN-WORLD: 沿用奶油紙／墨紙、細墨線、既有 popup 圓角與主色按鈕，沒有新品牌或圖片。

STORY: 考生看到作者文字，讀完按「已讀」；測試者一直看得到「測試模式」標示。

FIRST VIEWPORT: 右下方一張至多 400px 寬的公告紙條，底部避開作答工具列；手機左右留白，長文可捲，已讀按鈕固定可見。公告從下方進入，不搶焦點；一次只顯示一則。

FORM: 既有通知系統的局部 code-led 擴充，不進行新世界形式抽選。seed: not applicable (established-world local component extension; no roll)。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Behavior
test/live 分別去重與計數。到期自動撤下，已讀在本機即刻保存並重試回報；作者修改同一則內容不重設已讀，新公告需新增文件。測試開關不是作者驗證。
