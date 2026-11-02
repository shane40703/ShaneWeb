# GA 事件紀錄

記錄網站送到 Google Analytics 4 的事件，看報表或改事件時查這份。事件定義在 [src/lib/analytics.ts](src/lib/analytics.ts)，改事件時要一起更新這裡。

最後核對：2026-11-02

## 參數

每個事件都帶這三個參數：

| 參數            | 說明                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `practice_area` | 在哪個區塊練習，由 `practice_mode` 決定                                                                                                                                                                  |
| `practice_mode` | 用哪種方式練習：`daily_quiz` 每日抽題練習、`mock_exam` 歷屆試題模擬考、`law_cloze` 法規克漏字、`paper` 製作紙本、`exams` 考古題討論版、`wrong_retry` 常錯題目重練、`difficult_retry` 難題標記重練 |
| `subject`       | 科目：`law` 法規、`env` 環控、`construction` 構造、`structure` 結構                                                                                                                                      |

```text
practice_area 在哪個區塊練習 → practice_mode 用哪種方式練習
├ daily 每日練習
│  ├ daily_quiz 每日抽題練習
│  ├ mock_exam 歷屆試題模擬考
│  ├ law_cloze 法規克漏字
│  └ paper 製作紙本
├ exams 考古題討論版
│  └ exams 考古題討論版
└ review 重練
   ├ wrong_retry 常錯題目重練
   └ difficult_retry 難題標記重練

subject 科目
├ law 法規
├ env 環控
├ construction 構造
└ structure 結構
```

## 事件樹

共五個自訂事件，順序和 GA 面板一樣：事件 → `practice_area` → `practice_mode` 和觸發時機。

```text
practice_start 開始一輪練習
├ daily 每日練習
│  ├ daily_quiz：按「線上作答」、「重做這組題目」，或作答履歷的「再做一次」
│  ├ mock_exam：開始作答，或作答履歷的「再做一次」
│  └ law_cloze：這一輪第一次提交或看答案
└ review 重練
   ├ wrong_retry：從常錯題目開始一組重練，或按「重做這組題目」
   └ difficult_retry：從難題標記開始一組重練，或按「重做這組題目」

question_answered 寫了一題
├ daily 每日練習
│  ├ daily_quiz：按「確認答案」
│  ├ mock_exam：這題第一次選答案
│  └ law_cloze：按「提交答案」
├ exams 考古題討論版
│  └ exams：選了答案後按「看解答」
└ review 重練
   ├ wrong_retry：按「確認答案」，或在頁面內單題重新作答
   └ difficult_retry：同上

answer_revealed 沒作答就看答案
├ daily 每日練習
│  └ law_cloze：按「直接看答案」
└ exams 考古題討論版
   └ exams：沒選答案就按「看解答」

practice_complete 完成一輪練習
├ daily 每日練習
│  ├ daily_quiz：按「完成練習」
│  ├ mock_exam：按「交卷」
│  └ law_cloze：最後一題提交或看答案
└ review 重練
   ├ wrong_retry：按「完成練習」
   └ difficult_retry：同上

paper_download 製作出一份紙本練習卷
└ daily 每日練習
   └ paper：按「製作紙本檔案」，檔案成功產生後才算
```

## 看報表時要注意

- `practice_complete` 不代表每題都寫完，抽題和模擬考都可以留空題完成。
- 模擬考選了答案就算寫一題，其他方式要對答案才算。模擬考之後改答案不再算，沒交卷的題目也算得到。
- 討論版每按一次「看解答」算一次，收起後再看會再算，所以是次數，不是不重複的題數。
- 討論版只讀題、看討論不送練習事件，要看頁面瀏覽和停留時間。
- 常錯題目和難題標記頁面內的單題重新作答，只送 `question_answered`，不算一輪。
- 法規克漏字打開就已經出題，所以第一次提交或看答案才算開始。`subject` 固定是 `law`。
- 只有正式網站會送。開發環境、測試、Storybook，以及用過 `?ga=off` 的瀏覽器都不會送。

## 不能送的資料

帳號、Email、題號、答案、分數、筆記和討論內容都不能送，這是隱私權政策頁對外的承諾。事件只放固定的名稱和科目。

## 其他會看到的事件

這些不是自訂事件，不用註冊。

| 事件                                            | 來源                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `page_view`                                     | 程式自己送。換頁才算，換題不算；考古題討論版的每一題都記成 `/exams`。 |
| `first_visit`、`session_start`、`user_engagement` | GA 自動記錄。                                                           |

## GA 後台設定

| 設定                                                 | 目前狀態                                                   | 原因                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| 自訂維度 `practice_area`、`practice_mode`、`subject` | 已建立，事件範圍                                           | 沒註冊的參數不能放進報表，註冊前的資料當作不會補上                   |
| 加強型評估（Enhanced measurement）                   | 關閉，必須維持關閉                                         | 開啟後換題會多算頁面瀏覽，還會把含題號的完整網址送給 GA               |
| 排除的參照來源                                       | `firebaseapp.com`、`accounts.google.com`                   | 登入跳轉不能算成流量來源                                             |
| 重要事件（Key event）                                | 尚未設定，只有 GA 預設的 `purchase`                        | 原本規劃把 `question_answered` 設為重要事件，每個工作階段算一次       |
| 事件資料保留期限                                     | 未確認                                                     | 應改成 14 個月；預設 2 個月，探索報表比不到去年考季                  |
| Google 信號                                          | 關閉                                                       | 隱私權政策頁寫明沒有廣告功能                                         |

加強型評估、排除的參照來源和重要事件不用登入 GA 也查得到：`curl 'https://www.googletagmanager.com/gtag/js?id=G-R4DWVC89GV'`，裡面出現 `__ccd_em_` 開頭的項目代表加強型評估開著，`__ogt_referral_exclusion` 是排除清單，`__ccd_conversion_marking` 是重要事件。

## 新增或修改事件

1. 在 `src/lib/analytics.ts` 的 `PracticeEvent` 或 `PracticeMode` 加上名稱，並在功能裡呼叫 `trackPractice`。
2. 更新這份文件。
3. 新參數要先到 GA 後台註冊成事件範圍的自訂維度，再部署。
4. 送出的內容有變時，同步更新隱私權政策頁，並確認沒有送出上面列的資料。
