# 讓影像跨出二維：Raindrop

以靜態照片作為 t=0，從照片幾何證據產生 RippleEvent，再推測一條可能過去、模擬一條可能未來。最後畫面重採樣原始照片的 pixels，不是疊加動畫圓。

## 開啟方式

用 VS Code 開啟 `raindrop` 資料夾，使用已安裝的 Live Server 開啟 `index.html`。或在專案資料夾的終端機執行 `python3 -m http.server 8765 --bind 127.0.0.1`，瀏覽 `http://127.0.0.1:8765`。不要直接以 file:// 開啟，shader、照片需要同源HTTP載入。

第一次會從 CDN 載入 p5.js 1.11.3、OpenCV.js 4.13.0，需要網路。若失敗，狀態列會提示。GPU 需要 WebGL2 與 EXT_color_buffer_float；不支援時仍能看分析圖，但不能模擬。

## 操作

1. 等待狀態列出現 Hough → radial → clusters → events 數量。
2. S 看原圖、H/R/C/V 檢查候選→篩選→合併→事件。
3. F 看最終渲染，拖曳時間軸或按播放。負值是推測歷史，正值是波動模擬。
4. W 看波高，D 看相對照片的位移。0 或「回到照片0」可回到原照片。
5. 「匯出高解析PNG」輸出目前到位的時間，預設2160×3840；JSON按鈕保存統一事件資料。

完整鍵盤：S 原圖、A 分析縮圖、G 灰階、B 模糊、M 梯度、E Canny、H Hough、R radial、C clustered、V event、W wave、D displacement、F final；空白鍵播放/暫停，0重設。輸入框和下拉選單有焦點時不攔截按鍵，先點空白區。

選單可以向未來1×/0.5×或向過去1×。到邊界預設循環。向後查看正時間會重建計算，不是倒轉阻尼。狀態列同時顯示目標與實際畫面時間，回算中等待完成再匯出。

## 實際檔案與資料流

|檔案|用途|
|---|---|
|index.html|載入函式庫與模組，提供中文控制介面與載入失敗提示|
|config.js|所有可調參數及方向註解|
|sketch.js|p5生命週期、縮圖、debug overlay、timeline、PNG/JSON匯出|
|imageAnalysis.js|保留原分析與徑向評分，新增finally釋放所有Mat|
|eventDetection.js|半徑/圓心雙條件合併及純資料RippleEvent接口|
|waveSimulation.js|獨立WebGL2 canvas、浮點texture/framebuffer、seek與渲染|
|shaders/fullscreen.vert|全畫面三角形，統一左上UV|
|shaders/seed.frag|照片當下初始條件與負時間波包模型|
|shaders/wave.frag|四鄰點離散波動、阻尼與邊緣吸收|
|shaders/render.frag|波場差分→斜率→照片位移與方向性明暗|
|docs/PARAMETERS.md|逐項參數、單位、預設、範圍與風險|
|docs/LEARNING_GUIDE.md|以實際程式解釋每一層及函式|
|_backup_before_work/|修改前index.html/sketch.js，保留原始版本|
|assets/raindrop.JPG|未修改的3375×6000原始照片|

照片 → 分析縮圖 → 灰階/blur → Hough → Sobel/radial score → 門檻 → 固定anchor clustering → RippleEvent[] → seed波場 → 負時間解析式／正時間固定步ping-pong → 與t=0參考場相減 → 中央差分斜率 → 原始照片重採樣＋高光陰影。

模擬使用原生WebGL2而非p5.Framebuffer：同樣是浮點framebuffer ping-pong，但讓既有p5的2D debug與操作維持不變。不是把circle動畫換個名稱。

## 修改參數

所有設定在 `config.js`。編輯儲存後重新整理，或在開發者工具修改 CONFIG 後按「重新套用設定」。後者重新偵測並重建波場，時間回到0。請先閱讀 PARAMETERS。程式拒絕不合法核大小及不符合CFL的模擬參數。

source、analysis、simulation、display、export 是獨立解析度；輸出高解析不會讓低解析波場憑空增加細節。請維持照片9:16比例，避免非等比例拉伸。

## 模型邊界

- 單張照片不能決定真實撞擊時間、深度、波速或照明；radius/speed只是可調藝術假設。
- confidence是徑向幾何一致性，並非統計校準的雨滴機率。
- 同心不同半徑保留為多個事件假設，可能實際來自同一雨滴；event數量不是雨滴計數。
- 過去以帶高斯包絡的餘弦波包重建，未來以線性二維離散波動演算。不是完整流體、色散、水深或透視模型。
- source照片已包含靜態波紋；此版本沒有分離「沒有波紋的背景」。因此推回撞擊前不會擦除照片原有紋理；波場差分是在其上重採樣。可能出現殘留/雙重波紋。
- t=0場差分為0，光學處理不改變照片；瀏覽器色彩管理與照片縮放仍可能有細微差異。
- 不注入新的隨機雨滴，未來只由照片事件演化。阻尼削弱振動，但最終場相對照片基準不一定回到零差分，因此長時間渲染可能留下靜態位移。
- 事件超過maxEvents時只把高分者送GPU，所有clusters仍能在C檢查，狀態列顯示數量。預設256足以容納這張照片目前結果。
- PNG是單幀輸出，沒有MP4/批次影格錄製。可逐時間點匯出；提高export尺寸受GPU與記憶體限制。

GPU格式依據：[Khronos EXT_color_buffer_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/)。
