---
name: 建築師考試練習平台
description: 米色方格紙上的建築師方格筆記本：奶油面板、一層墨線框、一支墨線藍，安靜不打擾。
colors:
  rice-paper: "#eadfc9"
  grid-line: "#d3c9b5"
  grid-line-soft: "#e3d9c3"
  cream-sheet: "#fef9f1"
  cream-sheet-lifted: "#fffbf3"
  cream-tint: "#f6edda"
  cream-deep: "#e2d6bc"
  ink: "#373737"
  ink-soft: "#4f4f4f"
  ink-muted: "#636363"
  ink-disabled: "#8a8479"
  pencil-line: "#cfc5ae"
  ink-line: "#6b665d"
  frame-line: "#a39b8c"
  ink-blue: "#3157ba"
  ink-blue-deep: "#283f7d"
  ink-blue-bright: "#3b60c5"
  ink-blue-pressed: "#1f396c"
  ink-blue-wash: "#e2e6f2"
  on-ink-blue: "#ffffff"
  focus-halo: "rgb(49 87 186 / 40%)"
  correct-green: "#176840"
  correct-wash: "#e1eedd"
  wrong-red: "#b03527"
  wrong-wash: "#fae7e1"
  mark-amber: "#875009"
  mark-wash: "#f7e8cc"
  note-purple: "#5f41ab"
  note-wash: "#ece6f4"
  subject-orange: "#9a5a0f"
  chart-2: "#1f7a4d"
  chart-3: "#c9741a"
  chart-4: "#6b4bb8"
  chart-5: "#d14b4b"
  chart-6: "#7a7468"
  image-white: "#ffffff"
  backdrop: "rgb(40 36 30 / 45%)"
typography:
  display:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "clamp(72px, 10cqi, 128px)"
    fontWeight: 600
    lineHeight: 1.1
    fontVariation: "tabular-nums"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "clamp(24px, 3cqi, 36px)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  panel-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  question:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.04em"
  eyebrow:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  none: "0"
  frame: "2px"
  control: "4px"
  popup: "6px"
  round: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "48px"
components:
  panel:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.frame}"
    padding: "24px"
  card-clickable:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.frame}"
    padding: "22px 24px"
  button:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  button-hover:
    backgroundColor: "{colors.cream-sheet-lifted}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.ink-blue-deep}"
    textColor: "{colors.on-ink-blue}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.ink-blue-pressed}"
    textColor: "{colors.on-ink-blue}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-blue}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.wrong-red}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  button-icon:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0"
    width: "40px"
    height: "40px"
  select:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  input:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  textarea:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  option-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.question}"
    rounded: "{rounded.none}"
    padding: "12px 52px 12px 10px"
  option-row-hover:
    backgroundColor: "{colors.cream-tint}"
    textColor: "{colors.ink}"
  option-row-selected:
    backgroundColor: "{colors.ink-blue-wash}"
    textColor: "{colors.ink}"
  option-row-correct:
    backgroundColor: "{colors.correct-wash}"
    textColor: "{colors.ink}"
  option-row-wrong:
    backgroundColor: "{colors.wrong-wash}"
    textColor: "{colors.ink}"
  tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink-blue-deep}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.frame}"
    padding: "0 7px"
    height: "22px"
  question-tile:
    backgroundColor: "{colors.cream-sheet}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.frame}"
    width: "38px"
    height: "38px"
  question-tile-current:
    backgroundColor: "{colors.ink-blue-deep}"
    textColor: "{colors.on-ink-blue}"
  question-tile-correct:
    backgroundColor: "{colors.correct-wash}"
    textColor: "{colors.correct-green}"
  question-tile-wrong:
    backgroundColor: "{colors.wrong-wash}"
    textColor: "{colors.wrong-red}"
  question-tile-difficult:
    backgroundColor: "{colors.mark-wash}"
    textColor: "{colors.mark-amber}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.frame}"
    padding: "3px 6px"
    height: "40px"
  nav-item-active:
    backgroundColor: "rgb(40 63 125 / 10%)"
    textColor: "{colors.ink-blue-deep}"
  popup:
    backgroundColor: "{colors.cream-sheet-lifted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.popup}"
    padding: "4px"
  toast:
    backgroundColor: "{colors.cream-sheet-lifted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.popup}"
    padding: "12px 12px 12px 14px"
---

# Design System: 建築師考試練習平台

## Overview

**Creative North Star: "建築師的方格筆記本"**

這個介面是一本建築師隨身的方格筆記本。頁面本身是米色方格紙，24px 一格；題目、作答紀錄、筆記與錯題都寫在同一本上，用奶油色的紙張面板、一圈細墨線框和實線、虛線的分隔來整理，而不是用顏色塊或陰影堆疊。使用者每天翻開它練習幾題，所以它必須安靜、不打擾：裝飾退到零，只留下讀題與作答需要的結構，長時間使用也不疲勞。

整本筆記只有一支筆：墨線藍。它畫出目前所在的題號、連結、主要按鈕與焦點框，其餘一律是墨色文字與紙色。綠、紅、琥珀、紫四個狀態色只用來回報答對、答錯、難題標記與筆記，不當裝飾。操作元件是筆記本裡的工具：輕、安靜、不搶題目。按鈕、輸入框、選項列都是一圈細框，按下去一定有反應，但從不浮起、放大或發光。

風格參考來源是 illoca.com 的 legal、changelog 與 community 頁：方格紙背景、以線條與外框分區、靜態的排版。配色取自參考頁並把藍色加深，讓文字直接放在方格紙上也清楚。深色模式與 24px 方格是本站自行設計的暖黑「墨紙方格」，參考站沒有深色版本。

**Key Characteristics:**
- 米色方格紙底（24px 格），內容放在奶油色面板上，面板只有一圈 1px 細框、2px 近直角。
- 一層框原則：外面有框，裡面只用線分隔；裡面需要框，外面就改用線。
- 一支筆：墨線藍是唯一的強調色，狀態色只報告作答結果。
- 標題中等粗細（600）；日期、年度、題號、數量用等寬字小標。
- 平面為主，沒有漸層與浮起；只有離開紙面的下拉選單、對話框、通知有一道硬邊偏移陰影。
- 每個顏色都有深色雙生子，元件只用 CSS 變數，使用者可換官方配色或自訂六色。

## Colors

整個調色盤是紙與墨：米色紙底、奶油色紙面、三個深淺的墨色文字，加上一支墨線藍；狀態色沉穩、低飽和，和紙色放在一起不跳。前言的數值是預設淺色「米紙方格」；每個 token 在 `:root[data-theme='dark']` 都有深色雙生子（見下方 Dark Mode）。元件一律寫 `var(--token)`，從不寫死色碼，因為設定頁可以換官方配色或自訂六色。

### Primary
- **墨線藍** (`--primary`, #3157ba)：連結、未選取的強調文字、選取的單選鈕、焦點外框、滑過可點擊大方塊時的框線。
- **深墨線藍** (`--primary-strong` 與 `--primary-solid`, #283f7d)：主要按鈕與目前題號的實心底、側欄目前頁的文字、小標題強調。主要按鈕滑過用 **按壓墨線藍** (`--primary-solid-hover`, #1f396c)。
- **墨線藍水洗** (`--primary-soft`, #e2e6f2)：已選取選項列與下拉選單高亮的淡底，搭配 2px 墨線藍左邊線。
- **焦點暈** (`--focus`, rgb(49 87 186 / 40%))：僅供鍵盤焦點的半透明暈，實際焦點框是 2px 實線墨線藍。

### Neutral
- **米紙** (`--bg`, #eadfc9)：頁面底色，上面印 24px 方格。**方格線** (`--grid-line`, #d3c9b5) 水平與垂直同一色；**淡方格線** (`--grid-line-soft`, #e3d9c3) 給更退後的格線。
- **奶油紙** (`--surface`, #fef9f1)：所有面板、按鈕、輸入框的紙面；側欄與頂部列也是這個色。**提亮奶油紙** (`--surface-elevated`, #fffbf3) 給浮出的紙張與按鈕滑過。**奶油淡底** (`--surface-2`, #f6edda) 給選項列滑過與次要區塊。**深奶油** (`--surface-3`, #e2d6bc) 給分隔更強的底。
- **墨** (`--text`, #373737)：內文與標題。**軟墨** (`--text-soft`, #4f4f4f) 給說明段落。**淡墨** (`--muted`, #636363) 給小標、來源、次要資訊。**失效墨** (`--disabled-text`, #8a8479) 給刪去的選項。
- **鉛筆線** (`--line`, #cfc5ae)：面板內的實線分隔，以及 `--rule`。**墨線** (`--line-strong`, #6b665d)：虛線分隔 `--rule-dashed`、浮出紙張的框。**框線** (`--control-line`, #a39b8c)：面板、按鈕、輸入框的 `--frame`。
- **圖片白** (`--image-surface`, #ffffff)：題目圖片的襯底，深色模式也維持白底。**遮罩** (`--backdrop`, rgb(40 36 30 / 45%))：對話框與抽屜後面的暗紙。

### Status
- **答對綠** (`--success`, #176840) 與 **答對水洗** (`--success-soft`, #e1eedd)：正確答案列、答對題號、成功通知。
- **答錯紅** (`--danger`, #b03527) 與 **答錯水洗** (`--danger-soft`, #fae7e1)：錯選的答案列、答錯題號、刪除類按鈕、錯誤訊息。
- **標記琥珀** (`--warning`, #875009) 與 **標記水洗** (`--warning-soft`, #f7e8cc)：難題標記按鈕按下的狀態、難題題號、持久化警告。
- **筆記紫** (`--purple`, #5f41ab) 與 **筆記水洗** (`--purple-soft`, #ece6f4)：題號角落的筆記圓點、有詳解或討論的標記。
- **科目色**：法規用墨線藍 (`--subject-blue`)、環控用答對綠 (`--subject-green`)、構造用 **科目橘** (`--subject-orange`, #9a5a0f)、結構用筆記紫 (`--subject-purple`)。只出現在科目圖示框與圖表，不染到頁面。
- **圖表色** (`--chart-1` 到 `--chart-6`)：墨線藍、#1f7a4d、#c9741a、#6b4bb8、#d14b4b、#7a7468，依序配給分析頁的類別。

### Dark Mode
深色是「墨紙方格」：暖黑紙底、淡米色文字，方格線退到背景裡。按鈕實心藍與答對、答錯、標記的實心色保持接近，水洗底改成深色調。

| 角色 | 淺色 | 深色 |
|---|---|---|
| 米紙 / 方格線 / 淡方格線 | #eadfc9 / #d3c9b5 / #e3d9c3 | #1b1915 / #2e2b26 / #25221e |
| 奶油紙 / 提亮 / 淡底 / 深奶油 | #fef9f1 / #fffbf3 / #f6edda / #e2d6bc | #23201b / #2a2620 / #2a2620 / #38332b |
| 墨 / 軟墨 / 淡墨 / 失效墨 | #373737 / #4f4f4f / #636363 / #8a8479 | #ede5d6 / #cfc6b5 / #a39b8c / #7e776b |
| 鉛筆線 / 墨線 / 框線 | #cfc5ae / #6b665d / #a39b8c | #3a352d / #8b8375 / #5a5347 |
| 墨線藍 / 深墨線藍 / 水洗 | #3157ba / #283f7d / #e2e6f2 | #8fa9f0 / #afc2f5（文字）、#3b60c5（實心） / #283352 |
| 按壓墨線藍 / 焦點暈 | #1f396c / rgb(49 87 186 / 40%) | #4b70d5 / rgb(143 169 240 / 45%) |
| 答對綠 / 水洗 | #176840 / #e1eedd | #6ccb95（文字）、#1f7a4d（實心） / #1f3328 |
| 答錯紅 / 水洗 | #b03527 / #fae7e1 | #f08a7a / #3a2420 |
| 標記琥珀 / 水洗 | #875009 / #f7e8cc | #e8b86a / #3a2e18 |
| 筆記紫 / 水洗 | #5f41ab / #ece6f4 | #c2a6f5 / #2e2640 |
| 側欄紙 / 側欄滑過 / 側欄目前 | #fef9f1 / rgb(55 55 55 / 6%) / rgb(40 63 125 / 10%) | #1f1c17 / rgb(255 255 255 / 6%) / rgb(143 169 240 / 14%) |
| 遮罩 / 硬陰影 | rgb(40 36 30 / 45%) / 6px 6px 0 rgb(55 55 55 / 10%) | rgb(0 0 0 / 55%) / 6px 6px 0 rgb(0 0 0 / 35%) |

### Named Rules
**一支筆規則。** 墨線藍是整本筆記唯一的強調色，只畫目前的題號、連結、主要按鈕與焦點；綠、紅、琥珀、紫只回報作答狀態與筆記，不做裝飾。一個畫面上若出現第二種「強調」，就是錯的。

**雙生子規則。** 每個顏色 token 都有深色雙生子，元件只寫 `var(--token)`，從不寫死色碼。設定頁可以換官方配色（米紙方格、現代紙白、藍圖晨光、松霧綠、鳶尾晨紫；墨紙方格、現代炭黑、藍圖深夜、深潮墨綠、夜幕鳶紫）或自訂六色，衍生 token 由程式計算並驗證對比（文字與強調色對紙面至少 4.5:1，淡墨至少 3:1）。只用 token 的元件才會跟著換色。

## Typography

**Display Font:** 系統等寬字（ui-monospace、SF Mono、Menlo、Consolas）
**Body Font:** 系統無襯線字（-apple-system、Segoe UI、Helvetica Neue，中文落到 Noto Sans TC、PingFang TC、Microsoft JhengHei）
**Label/Mono Font:** 同 Display 的等寬字

**Character:** 不另外下載字型，像筆記本一樣用手邊的筆。中文內文用系統無襯線，標題只到中等粗細（600），不用粗黑；所有數字類的小標（日期、年度、題號、數量、EXAM COUNTDOWN 這類眉標）換成等寬字並加字距，像圖紙角落的標註。

### Hierarchy
- **Display** (600、clamp(72px, 10cqi, 128px)、1.1、等寬、tabular-nums)：只用在首頁考試倒數的天數。
- **Headline** (600、clamp(24px, 3cqi, 36px)、1.3、字距 -0.01em)：首頁倒數區的標題；頁首的頁名只是 16px/600。
- **Title** (600、20px、1.3)：區塊標題與對話框標題（對話框 19px）；可點擊大方塊的標題 clamp(19px, 1.8vw, 22px)。
- **Panel Title** (600、16px)：面板內的標題，題號導覽、討論、投稿面板共用同一個尺寸。
- **Question** (400、18px、1.6、字距 0)：題幹與 A、B、C、D 選項文字，由 `--question-font-size` 與 `--option-font-size` 控制，閱讀設定可調大。這是頁面上最大的內文。
- **Body** (400、16px、1.5)：一般段落；說明文字用軟墨或淡墨，行高 1.6 到 1.7。
- **Control** (500、14px、1.3)：按鈕、下拉選單、輸入框文字；小型工具按鈕 13px。
- **Caption** (500、13px)：表單標籤、面板內的小標，用淡墨。
- **Label** (500、12px、字距 0.04em、等寬)：題號、年度、數量、來源行；**Eyebrow** (500、11px、字距 0.08em 到 0.12em、等寬、大寫英文)：面板上方的眉標如 QUESTION MAP、DISCUSSION、EXAM COUNTDOWN。

### Named Rules
**等寬標註規則。** 凡是數字、日期、年度、題號、數量與眉標，一律等寬字加字距，11px 到 12px，淡墨或深墨線藍；內文與標題永遠不用等寬。

**題目最大規則。** 題幹與選項是畫面上最大的內文（18px、可由使用者放大），所有介面文字停在 13px 到 14px，標題也不壓過題目的份量。

## Layout

版面是一本攤開的筆記本：左側 260px 的奶油色側欄貼著一條實線右框，頂部列 64px 貼著一條實線下框，其餘全是方格紙。主內容區最寬 1600px，置中，內距 24px 上下、28px 左右、底部 48px；手機 18px 上下、16px 左右。面板之間的距離是 24px，等於一個方格；面板內距 24px，窄面板 20px，題目列 18px 20px，手機一律 16px。

同一個面板裡的小節用實線（`--rule`，1px 鉛筆線）分隔，不同區塊之間、側欄的品牌與工具區用虛線（`--rule-dashed`，1px 墨線）分隔。作答頁是兩欄：題目欄彈性寬度，右側 340px 的題號導覽面板 sticky 在頂部列下方；考古題討論版同樣兩欄。可點擊的大方塊（首頁四科、每日練習總覽的三張卡）排成等寬網格，間距 16px，滑過時框線變墨線藍。我的作答存摺總覽的頁面連結不用方塊，放在一層框的帳目面板裡，一列一頁、列間實線，整列可點，滑過時標題變深墨線藍並加底線。

斷點依頁面自己的寬度而不是視窗：頁面根元素設 `container-type: inline-size`，兩欄在 900px 收成一欄，大方塊在 640px 收成直排，首頁四科在視窗 1050px 變兩欄、560px 變一欄。側欄在視窗 800px 以下收進左側抽屜，頂部列改 60px，帳號與主題按鈕縮成 36px 方形圖示鈕。

### Named Rules
**一層框規則。** 一個面板只有一圈框。外面有框的，裡面只放文字、線和操作元件；裡面需要框的（年度分組、題目列、可點擊方塊），外面就改用線分隔。按鈕、輸入框、選項列、標籤是操作元件，不算框，可以放在面板裡。

**依容器收合規則。** 頁面版面用 `@container` 在頁面根元素上收合，不用視窗 `@media`；因為側欄佔掉的寬度會變。只有側欄本身與全站外框用視窗寬度（800px）判斷。

## Elevation & Depth

整個系統是平的：面板、按鈕、輸入框、可點擊方塊貼在紙上，用一圈框線和紙色的深淺（奶油紙、淡底、深奶油）表達層次，沒有陰影、漸層或滑過浮起。只有真正離開紙面的東西才有影子：下拉選單、對話框、設定紙、通知，用一道硬邊偏移陰影 (`--shadow-lg`, 6px 6px 0 rgb(55 55 55 / 10%)；深色 rgb(0 0 0 / 35%))，像一張紙疊在筆記本上。`--shadow-sm` 與 `--shadow-md` 刻意是 none。遮罩用 `--backdrop` 加 2px 模糊。

### Shadow Vocabulary
- **浮紙** (`box-shadow: var(--shadow-lg)` = `6px 6px 0 rgb(55 55 55 / 10%)`)：下拉選單面板、確認對話框、設定紙、通知。
- **選取左線** (`box-shadow: inset 2px 0 0 var(--primary)`)：已選取的選項列左緣的 2px 墨線藍，是狀態不是深度。

### Named Rules
**浮紙才有影規則。** 貼在頁面上的東西一律沒有陰影；只有以 popup 或 dialog 形式離開紙面的層才用 `--shadow-lg` 硬陰影，而且永遠是硬邊偏移，不是模糊光暈。

## Shapes

形狀語言是近直角的紙與框。面板、可點擊方塊、標籤、題號方塊的轉角是 2px (`--radius-frame`)，看起來像直角但不割手；按鈕、輸入框、下拉選單、圖示鈕是 4px (`--radius-control`)；浮出的紙張是 6px (`--radius-popup`)。選項列沒有圓角也沒有框，直接接在題目下方，只靠相鄰的實線分隔。圓形只用在單選鈕（18px，內圓 10px）和題號角落 6px 的筆記圓點。

所有框都是 1px：面板與操作元件用框線色 (`--frame`)，浮出紙張用墨線 (`1px solid var(--line-strong)`)，空白佔位的地方用虛線 (`--frame-dashed`)，例如未登入徽章。

### Named Rules
**近直角規則。** 2px 給紙，4px 給操作元件，6px 給浮紙，0 給選項列，50% 只給單選鈕與圓點。不出現 8px 以上的圓角。

## Components

### Buttons
- **Shape:** 4px 圓角，1px 框線，高 40px，左右內距 14px，14px/500 文字，圖示與文字間距 8px。圖示鈕 40px 正方。
- **Primary:** 深墨線藍實心 (`--primary-solid`) 配白字，框線同色；滑過改按壓墨線藍。一個畫面通常只有一顆。
- **Secondary（預設）:** 奶油紙底、框線色框、墨色字；滑過框線變墨線、底變提亮奶油紙。沒有陰影、不位移。
- **Ghost:** 無框無底、墨線藍字；滑過變深墨線藍並加 1px 底線，像筆記本裡的連結。
- **Danger:** 奶油紙底、答錯紅字，框線是答錯紅與框線色各半的混色；滑過底變答錯水洗。
- **Toggle（難題標記）:** 就是預設按鈕，按下後改成標記琥珀字、標記水洗底、琥珀框；文字永不換行。
- **Focus:** 2px 實線墨線藍外框，offset 2px；所有可聚焦元件共用。
- **Disabled:** 透明度 0.5，游標 not-allowed。

### Chips (Tags)
- **Style:** 22px 高、左右 7px 內距、2px 圓角、等寬 11px/500 字距 0.03em；框是目前色 45% 透明、底是目前色 8% 透明。
- **Tones:** 預設深墨線藍（科目、題型）、綠（通過、環控）、紫（筆記、詳解）、橘（構造、提醒）。
- **科目圖示框:** 正方形框，底是科目色 12% 混奶油紙、框是科目色 35% 透明，圖示用科目色。

### Cards / Containers
- **Corner Style:** 2px。
- **Background:** 奶油紙。
- **Shadow Strategy:** 無；見 Elevation。
- **Border:** 1px 框線色實線；可點擊的大方塊滑過時框線變墨線藍，裡面的連結文字變深墨線藍並加底線。
- **Internal Padding:** 24px，窄面板 20px，可點擊方塊 22px 24px，手機 16px。面板內的 header 下方 14px 處一條實線，group 之間一條實線，區塊之間虛線。

### Inputs / Fields
- **Style:** 奶油紙底、1px 框線色、4px 圓角、高 40px、左右 12px 內距、14px 文字；textarea 內距 10px 12px、可垂直拉伸；筆記編輯器 15px/1.75。
- **Label:** 13px/500 淡墨，與欄位間距 6px。
- **Focus:** 框線變墨線藍（表單）或 2px 墨線藍外框（按鈕類）。
- **Select:** 外觀同輸入框，右側淡墨箭頭，開啟時框線變墨線藍；選單是浮紙（提亮奶油紙、墨線框、6px、硬陰影），項目 36px 高，高亮為深墨線藍字加墨線藍水洗底。
- **Placeholder:** 淡墨 82% 透明。

### Navigation
- **Sidebar:** 260px，奶油側欄紙，右框實線；品牌區 48px，下方虛線；項目 40px 高、15px/400、2px 圓角、左側 18px 線條圖示用墨線藍；滑過淡灰底，目前頁用側欄目前底加深墨線藍 600 字；總覽底下的頁面也標示該總覽。工具區（設定、問題回報）靠底，上方虛線。
- **Topbar:** 64px，奶油紙，下框實線；左側頁名 16px/600，右側主題切換與帳號按鈕（34px 高、13px/500 細框鈕）。
- **Mobile:** 800px 以下側欄變 310px 寬的左側抽屜，240ms 滑入；頂部列 60px，按鈕縮成 36px 圖示鈕。
- **Tabs:** 考古題討論版的分頁列是鋪在方格紙上的半透明紙：提亮奶油紙 55%，方格透得過來，下緣一條鉛筆線，沒有外框。分頁高 44px、左右內距 16px、14px/500 軟墨字，右側可放等寬 11px 的數量。目前分頁是同一張紙的不透明底、蓋在鉛筆線上的 2px 墨線藍底線加深墨線藍 600 字，切換時 180ms 滑到新的分頁；滑過的分頁只是更不透明一點，不透明的底只留給目前分頁。焦點框畫在分頁內側。頁面窄於 480px 時分頁平分整列。

### Option Rows（Signature）
A、B、C、D 選項列是這個系統的簽名元件，所有出現選項的地方（每日抽題、模擬考、常錯、難題、考古題、作答紀錄、閱讀設定預覽）共用同一個元件。
- **Structure:** 無框、無圓角、直接接在題目下方；相鄰兩列之間一條鉛筆線，列表上下沒有線。每列最少 52px 高，內距 12px 52px 12px 10px，三欄：18px 單選鈕、24px 等寬字母、題目字級的文字。
- **States:** 滑過淡底；已選取為墨線藍水洗底加 2px 墨線藍左線；確認答案後鎖定，滑過不再變色。對答案時正確列是答對水洗底加 2px 答對綠左線、字母格變綠底白字；錯選列是答錯水洗底加 2px 答錯紅左線、字母變紅。每列預留透明的 2px 左線，所以狀態變色時文字不位移。
- **Eliminate:** 右側 32px 的刪去鈕，刪去後文字變失效墨並加刪除線。

### Question Number Tiles（Signature）
38px 正方、2px 圓角、1px 框、等寬 12px/500，間距 6px，自動填滿一排。底色說狀態：目前題是深墨線藍實心白字；答對是答對水洗配綠字；答錯是答錯水洗配紅字；難題是標記水洗配琥珀字（與答對、答錯重疊時框線維持琥珀）。右上角 6px 筆記紫圓點表示有筆記，左上角表示有共享內容。

### Popups and Toasts
- **Dialog:** 440px 寬、24px 內距、提亮奶油紙、1px 墨線框、6px 圓角、硬陰影、置中文字；危險動作上方放 40px 的紅框圖示格。
- **Toast:** 右下角堆疊的紙條，360px 寬、64px 高，左側 28px 色調圖示格（綠、紅或藍），標題 14px/600、說明 12px 淡墨；300ms 彈性曲線滑入。
- **Settings sheet:** 1120px 寬的設定紙覆蓋在頁面上，header 64px 加實線，眉標 11px 等寬字距 0.12em。

### Empty State
兩行置中的文字，沒有圖示方塊也沒有最小高度：標題 16px/600 軟墨 (`--text-soft`)，說明 14px 淡墨 1.6 行高，內距 32px 20px，需要時下方放按鈕群。讀取中、載入失敗與沒有資料長得一樣，只差文字。

## Do's and Don'ts

### Do:
- **Do** 把頁面放在 24px 方格的米紙上，內容用奶油紙面板承載，面板只有一圈 1px 框線色實線和 2px 轉角。
- **Do** 遵守一層框規則：面板內用 `--rule` 實線分小節、`--rule-dashed` 虛線分區塊；需要內框時把外框拿掉改用線。
- **Do** 把鉛筆線畫在面板或半透明的底上：直接畫在方格紙上的線會和方格重複。
- **Do** 只用 `var(--token)` 取色，讓淺色、深色、官方配色與自訂配色全部跟著變。
- **Do** 把墨線藍留給目前題號、連結、主要按鈕與焦點；狀態色只回報答對、答錯、難題、筆記。
- **Do** 數字、日期、年度、題號、數量與眉標用等寬字 11px 到 12px 加字距；題幹與選項保持 18px 並可由使用者放大。
- **Do** 操作元件統一 40px 高、4px 圓角、1px 框線；主要按鈕是深墨線藍實心白字，一個畫面一顆。
- **Do** 選項列一律用共用的 OptionGroup 或 QuestionAnswerPanel 元件，不在頁面裡重畫。
- **Do** 頁面版面用頁面根元素的 `@container` 收合；側欄在 800px 以下收成抽屜。
- **Do** 只給離開紙面的下拉選單、對話框、通知加 `--shadow-lg` 硬邊偏移陰影；其餘保持平面。
- **Do** 所有可聚焦元件用 2px 實線墨線藍外框（offset 2px）表示焦點，並尊重 `prefers-reduced-motion`。
