# Raindrop Temporal Simulation — Work Handoff

## 0. 專案目標

這是一個以靜態攝影為 `t = 0` 的 **photo-conditioned temporal simulation**。

使用者對攝影的核心理解是：照片是某個事件瞬間的擷取，因此照片中的視覺痕跡可以作為證據，推演「此前可能如何」與「此後可能如何」。本專案使用一張雨天水滴照片，從照片中辨識 ripple / raindrop 結構，再把這些結構轉成可演化的事件。

最終目標：

```text
possible / procedural past
          ↓
    photograph t = 0
          ↓
    simulated future
```

視覺上的重點是讓 **原照片的 pixels 本身被重新取樣、位移、折射與演化**，避免只在照片上疊加 `circle()` 動畫。

核心資料流：

```text
SOURCE PHOTO
↓
IMAGE ANALYSIS
↓
RIPPLE CANDIDATES
↓
RIPPLE EVENT DATA
↓
TEMPORAL MODEL
↓
WAVE SIMULATION
↓
DISPLACEMENT FIELD
↓
PHOTO RE-SAMPLING / REFRACTION
↓
GENERATIVE IMAGE
```

---

# 1. 現有專案位置與檔案

本機專案：

```text
/p5.js test/raindrop
```

目前目錄：

```text
raindrop/
├── assets/
│   └── raindrop.JPG
├── index.html
└── sketch.js
```

原始照片：

```text
3375 × 6000
9:16
```

目前 display canvas：

```text
1080 × 1920
pixelDensity = 1
```

目前 analysis image：

```text
source × 0.2
= 675 × 1200
```

重要：**不要 resize 或覆寫原始 source image。**
目前做法是複製出 `analysisImg` 後再縮小。

---

# 2. 目前已完成到哪裡

目前大致完成到：

```text
✅ Step 0  Minimal p5.js environment
✅ Step 1  Load original photograph
✅ Step 2  Central CONFIG
✅ Step 3  OpenCV.js integration
✅ Step 4  Independent analysis image
✅ Step 5  Visual structure analysis
   ✅ grayscale
   ✅ Gaussian blur
   ✅ Sobel gradient
   ✅ gradient debug view
   ✅ Canny edge
   ✅ edge debug view

✅ Step 6A Hough Circle candidate detection
✅ Step 6B Radial consistency scoring

⬜ Step 6C Candidate clustering / duplicate merge
⬜ Step 7  Ripple Event Data Model
⬜ Step 8  Standardized event debug visualization
⬜ Step 9  Temporal phase estimation
⬜ Step 10 WebGL pipeline
⬜ Step 11 Wave simulation buffers / ping-pong framebuffer
⬜ Step 12 Discrete wave simulation
⬜ Step 13 Inject detected events into wave field
⬜ Step 14 Forward simulation
⬜ Step 15 Procedural past
⬜ Step 16 Pixel displacement
⬜ Step 17 Refraction / highlight / optical response
⬜ Step 18 Timeline / playback
⬜ Step 19 Performance pass
⬜ Step 20 High-resolution render/export
```

---

# 3. 現有程式目前做了什麼

## `preload()`

載入 `assets/raindrop.JPG`。

用途：
- 保留 3375 × 6000 原始攝影資訊。
- 後續所有 render 最終都應以這張 source 作為高品質 texture。

---

## `buildAnalysisImage()`

用途：
- `img.get()` 複製 source。
- 將複製品縮到 analysis scale。
- 目前 scale = `0.2`，所以得到 675 × 1200。

目的：
- Computer vision 不需要每次處理 2000 萬 pixels。
- source / analysis / simulation / display 可以使用不同解析度。
- 後續事件位置全部使用 normalized coordinates，避免解析度綁死。

---

## `processAnalysisImage()`

目前 image-analysis 主流程：

```text
analysisImg
↓
ImageData
↓
OpenCV Mat
↓
grayscale
↓
GaussianBlur
↓
HoughCircles
↓
Sobel X / Y
↓
radial consistency score
↓
gradient magnitude
↓
Canny
↓
debug images
```

### Grayscale
把顏色暫時壓成亮度資訊。

原因：
目前辨識的是 edge、gradient、circular / radial structure，顏色不是主要辨識依據。
原照片色彩仍完整保留，後續 rendering 繼續使用原彩色照片。

### Gaussian Blur
抑制照片細小 grain / noise，避免所有細碎紋理都被當成 edge。

### Sobel
計算：
- `gradX`：水平亮度變化
- `gradY`：垂直亮度變化

用途：
- 建立 gradient magnitude debug view。
- 更重要的是提供 gradient direction 給 radial scoring。

### Canny
目前只作為 diagnostic / debug layer。
它協助檢查「哪些較強的結構有留下」，不是最終 ripple classifier。

### Hough Circles
輸出大量可能的 `(x, y, radius)` 圓形 hypotheses。

現在故意使用較寬鬆的 threshold，因為照片很多 ripple 很淡、只有部分弧線。
此階段偏向 high recall：寧可多抓，再由後續 scoring / clustering 清理。

### Radial Consistency Scoring
對每個 Hough candidate 沿圓周取樣。

概念：

```text
candidate center
↓
圓周取樣
↓
比較該位置的 gradient direction
與
center → sample 的 radial direction
↓
計算 alignment / support / radialScore
```

目前每個 candidate 有：

```js
{
  x,
  y,
  radius,

  radialScore,
  radialAlignment,
  radialSupport
}
```

`x / y / radius` 都使用 normalized coordinates。

---

# 4. 目前已確認的參數與調整經驗

目前 `CONFIG.analysis` 核心值：

```js
analysis: {
  scale: 0.2,
  blurKernel: 7,
  sobelKernel: 3,

  cannyLow: 16,
  cannyHigh: 48,

  hough: {
    dp: 1.2,
    minDist: 20,
    param1: 48,
    param2: 12,
    minRadius: 8,
    maxRadius: 80
  },

  radial: {
    samples: 72,
    radiusSearch: 3,
    minGradient: 8,
    alignmentThreshold: 0.65,
    keepThreshold: 0.50
  }
}
```

## 已實測的重要判斷

### Canny
曾比較：

```text
cannyLow = 15
cannyLow = 16
cannyLow = 17
```

搭配 high ≈ low × 3。

目前選擇：

```text
16 / 48
```

理由：
- 15 開始留下較多細碎 texture。
- 17 稍微太 sparse。
- 16 在主要結構與背景乾淨度間較平衡。

### Hough `param2`
比較過 16、12。

目前保留：

```text
param2 = 12
```

理由：
- `16` 對強 ripple 比較乾淨，但會漏掉左側較淡的圓形結構。
- `12` 能讓弱 ripple 進入候選集，代價是大量 overlapping / false candidates。
- 後續應透過 scoring + clustering 處理多餘候選，不要再次提高 param2 造成 weak ripple 消失。

### Radial score 實際分布
目前曾量到：

```text
min    = 0.3736996720
median = 0.5965930787
max    = 0.9105712304
```

因此原本 `keepThreshold = 0.30` 幾乎完全沒有篩選效果。

目前改成：

```text
keepThreshold = 0.50
```

可視化後已開始看出候選線條粗細差異。

---

# 5. 目前 debug keyboard

請保留現有 debug modes，後續再擴充。

```text
S = source photograph
A = analysis image
G = grayscale
B = blurred grayscale
M = gradient magnitude
E = Canny edge
H = raw Hough candidates
R = radial-scored / radial-filtered candidates
```

後續建議：

```text
C = clustered candidates
V = final RippleEvent visualization
W = wave field
D = displacement field
F = final render
```

Debug views 是這個專案的重要架構，不要為了整理 code 移除。

---

# 6. 下一個最直接工作：Step 6C clustering

目前最大問題是：

```text
同一個實際 ripple
→ Hough 產生很多圓心略偏、半徑略不同的 hypotheses
```

需要做 duplicate clustering。

重要條件：

### 可以 merge
```text
center 很接近
+
radius 也很接近
```

例如 radius：

```text
30 / 32 / 34
```

很可能是同一條 ripple 的重複偵測。

### 不要 merge
```text
center 很接近
+
radius 差很多
```

例如：

```text
30 / 65
```

這可能是真實的 concentric multi-ring ripple。

建議：
- 用 center distance + radius difference 判斷 duplicate。
- radialScore 高的 candidate 權重較大。
- cluster 結果保留：
  - weighted x/y/radius
  - average / peak confidence
  - member count
- clustering 參數全部放進 CONFIG。

---

# 7. Step 7：RippleEvent 統一資料接口

這是後續最重要的容錯層。

Computer vision 的內部格式不要直接傳進 simulation。

請建立統一事件格式，例如：

```js
{
  id,

  x,              // normalized 0–1
  y,              // normalized 0–1
  radius,         // relative to image width

  strength,
  confidence,

  radialScore,
  radialSupport,
  radialAlignment,
  detectionMembers,

  phase,
  velocity,
  decay
}
```

後面的 temporal model / simulation 只接受：

```text
RippleEvent[]
```

因此未來若改成：
- OpenCV
- 手動 event
- AI detection
- 其他演算法

simulation 不需要重寫。

---

# 8. Temporal model 的概念要求

照片是：

```text
t = 0
```

## Future
`t > 0`

應以 wave simulation 推演：

```text
current state
↓
wave propagation
↓
next state
```

## Past
`t < 0`

不要單純倒播含 damping 的 wave simulation。

使用 parametric history：

```text
impact time
center
velocity
current radius
strength
decay
phase
```

以目前 radius / phase 推回：

```text
possible past
```

請保留概念差異：

```text
past = 從照片證據推測的一條 possible history
future = 從目前狀態依規則演算的一條 possible consequence
```

不要把兩者寫成「真實過去 / 真實未來」。

---

# 9. Wave simulation

目標是建立 2D scalar wave field：

```text
height(x, y, t)
```

不要用 `circle()` 直接畫 ripple。

建議使用：

```text
p5.js WEBGL
+
p5.Framebuffer
+
fragment shader
+
ping-pong buffers
```

例如：

```text
Framebuffer A = current
Framebuffer B = next

A → shader → B
B → shader → A
```

wave state 至少考慮：

```text
current state
previous state / velocity equivalent
neighbor pixels
damping
```

所有 simulation resolution / damping / speed 參數集中到 CONFIG。

---

# 10. Pixel displacement / final visual

核心要求：

原始照片不只是背景。

wave field 需要改變原照片的 sampling coordinate。

概念：

```glsl
texture(photo, uv)
```

變成：

```glsl
texture(photo, uv + displacement)
```

displacement 由 wave gradient 產生。

視覺效果應包含：
- ripple 周圍 pixel 位移
- 折射感
- 局部 highlight / shadow
- 波紋擴張後逐漸衰減
- 接近靜止後回到較穩定狀態

避免最終看起來只是「果凍 warp」。
可利用 wave normal / gradient 加入 subtle refraction、highlight、shadow。

`t = 0` 應盡可能與原始照片對齊。

---

# 11. Timeline

請完成統一 timeline。

至少需要：

```text
past ← t = 0 → future
```

功能：
- play / pause
- reset t=0
- 可來回播放或 slider
- 正時間：future simulation
- 負時間：procedural past

UI 可以簡單，但功能需要清楚。

---

# 12. Resolution / performance 原則

保持四種解析度可獨立設定：

```text
source resolution
analysis resolution
simulation resolution
display resolution
```

目前：

```text
source     3375 × 6000
analysis   675 × 1200
display    1080 × 1920
```

simulation 可先從：

```text
540 × 960
```

或 CONFIG 的 `simulation.scale = 0.5` 開始，再依效能調整。

重要：
simulation 低解析，不代表 source texture 也要低解析。

---

# 13. Work 可以重構，但請遵守

現有 `sketch.js` 已經很長。

允許重構成：

```text
raindrop/
├── index.html
├── sketch.js
├── config.js
├── imageAnalysis.js
├── eventDetection.js
├── waveSimulation.js
├── render.js
├── shaders/
│   ├── wave.vert
│   ├── wave.frag
│   └── render.frag
├── assets/
│   └── raindrop.JPG
└── docs/
    ├── README.md
    ├── PARAMETERS.md
    └── LEARNING_GUIDE.md
```

可以依實際需要調整檔案數量。

原則：
- 模組化要幫助理解。
- 不要為了「漂亮架構」把功能切得過度碎片化。
- `CONFIG` 必須集中。
- 保留 debug modes。
- normalized coordinate 規則保持不變。
- source image 不被破壞。
- detection / event / simulation / rendering 四層互相分開。

---

# 14. 使用者對最終交付檔案的強制要求

## A. 所有可更動參數必須清楚標明

請在 code 與 `PARAMETERS.md` 同時整理。

每個參數至少寫：

```text
參數名稱
目前預設值
單位
作用在哪一層
調高會怎樣
調低會怎樣
合理調整範圍
是否可能造成效能 / 偵測問題
```

例如：

```text
CONFIG.analysis.blurKernel
Default: 7
Layer: image analysis
作用：先模糊小型 noise，避免 Sobel/Canny 把 grain 當成 edge。
調高：畫面更平滑，noise 少，但弱 ripple 可能消失。
調低：保留更多細節，但 edge 會變碎。
限制：必須使用奇數。
建議測試：3 / 5 / 7 / 9 / 11
```

必須涵蓋：
- canvas / resolution
- analysis
- Canny
- Hough
- radial scoring
- clustering
- temporal model
- wave simulation
- damping
- propagation speed
- displacement
- refraction
- highlight/shadow
- timeline
- export / render

---

## B. 每個功能都要有簡單、詳細的說明

這是給未來回頭學習用的專案。

每個主要 function / class / shader 都請說明：

```text
1. 這個功能在整體流程的哪裡？
2. 它接收什麼？
3. 它做什麼？
4. 它輸出什麼？
5. 為什麼需要它？
6. 改哪些參數會改變效果？
7. 最容易出現什麼問題？
```

說明請使用簡單中文，假設讀者：
- 會基本 JavaScript
- 正在學 p5.js
- 對 OpenCV / shader / framebuffer 不熟

避免只寫：

```js
// calculate gradient
```

希望寫成：

```js
// Sobel 會比較附近 pixel 的亮度差，得到 X / Y 方向的變化。
// 這裡不直接把 Sobel 當成最終 edge，而是保留方向資訊。
// 後面的 radial scoring 會利用這個方向判斷某條弧線是否真的
// 大致以 candidate center 為中心向內 / 向外變化。
```

---

# 15. 最終文件要求

至少交付：

## `README.md`
包含：
- 專案概念
- 執行方法
- 檔案結構
- 完整 pipeline
- keyboard / UI controls
- 最終視覺邏輯
- 已知限制

## `PARAMETERS.md`
所有可調參數的詳細表格與調整建議。

## `LEARNING_GUIDE.md`
以學習導向解釋：
- p5.js 與 OpenCV 如何互通
- Mat / p5.Image
- grayscale / blur / Sobel / Canny
- Hough Circle
- radial consistency
- clustering
- normalized coordinates
- RippleEvent
- WEBGL
- fragment shader
- framebuffer
- ping-pong simulation
- discrete wave idea
- displacement sampling
- refraction / normal
- temporal model

請以目前專案實際 code 為例解釋，不要寫成抽象教科書。

---

# 16. 完成條件 / Acceptance Criteria

Work 完成前請自行驗證：

### Analysis
- source / analysis / grayscale / blur / gradient / edge 可切換。
- Hough candidates 可視化。
- radial candidates 可視化。
- clustering 後 duplicate 明顯減少。
- weak ripple 不因 clustering 全部消失。

### Event
- 所有 events 使用 normalized coordinates。
- detection 與 simulation 資料格式解耦。
- event 可視化顯示 center / radius / confidence。

### Simulation
- 每個 event 可注入 wave field。
- ripple 由 simulation 自行傳播，不是 `circle()` animation。
- damping 可調。
- simulation resolution 可獨立調整。

### Rendering
- wave field 真的改變 source photo pixel sampling。
- displacement / refraction 參數可調。
- t=0 與 source photo 對齊。
- future 能看到 ripple 發展與消散。
- past 能看到 procedural reconstruction。

### Timeline
- play / pause
- reset
- past / present / future 可查看

### Documentation
- README 完整。
- PARAMETERS 完整。
- LEARNING_GUIDE 完整。
- code 內有足夠中文註解。
- 所有可調參數集中、命名清楚。

---

# 17. 執行方式要求

請直接接手並完成，不需要每完成一小步就停下詢問。

只有在以下情況才需要停下：
- 本機依賴 / library 無法載入
- OpenCV / WebGL API 在目前版本不可用
- 需要使用者提供缺少的 source asset
- 需要做會破壞既有檔案的重大決策

修改前建議先備份現有：

```text
index.html
sketch.js
```

例如建立：

```text
_backup_before_work/
```

完成後回報：
1. 修改了哪些檔案
2. 每個檔案用途
3. 最終操作方式
4. 主要可調參數在哪裡
5. 已知限制
6. 哪些部分屬於物理近似 / artistic model，而不是科學重建
