# 可調參數

所有值集中在 `config.js` 的 CONFIG。編輯儲存後重新整理；開發者工具中修改 CONFIG 後，也可按「重新套用設定」。參數變更會重建事件和波場，時間回到0。

半徑、波長與速度一律以**圖寬**為尺度；y位置則除以圖高。分析像素參數只對縮圖有效。下表的提高/降低涵蓋視覺及效能影響，沒有校準成物理單位。

|參數（CONFIG.）|預設|單位|層／作用|建議範圍或限制|調高／調低與風險|
|---|---|---|---|---|---|
|canvas.width|1080|px|顯示寬度|540–2160|提高畫面細節與顯示成本；降低減少成本|
|canvas.height|1920|px|顯示高度|960–3840，與寬維持照片比例|提高細節與成本；降低較省效能|
|canvas.pixelDensity|1|倍|p5 顯示密度|1–2|提高更細緻但記憶體平方增加；降低較省|
|source.path|assets/raindrop.JPG|路徑|原始照片位置|同源 JPG/PNG|非數值；換圖後重新分析，不會改寫照片|
|analysis.scale|0.2|原圖倍率|分析縮圖|0.1–0.3|提高辨識細節與耗時；降低可能漏掉小波紋，Hough 像素參數需一起調|
|analysis.blurKernel|7|分析 px|高斯模糊核|3/5/7/9/11 奇數|提高去除雜訊但淡波紋消失；降低保留紋理與雜訊|
|analysis.sobelKernel|3|分析 px|方向梯度核|3/5/7|提高範圍及梯度數值；降低更局部，須重調 minGradient|
|analysis.cannyLow|16|亮度梯度|Canny 低門檻|8–40|提高邊緣變少；降低碎紋增加，只影響 E 圖|
|analysis.cannyHigh|48|亮度梯度|Canny 高門檻|低門檻的 2–3 倍|提高強邊緣變少；降低雜訊增，只影響 E 圖|
|analysis.hough.dp|1.2|倍率|Hough 累加器縮放|1–2|提高較省但圓心較粗；降低較細緻|
|analysis.hough.minDist|20|分析 px|Hough 圓心最小距離|5–40|提高候選少可能漏鄰近事件；降低候選多且分析更慢|
|analysis.hough.param1|48|梯度門檻|Hough 內部 Canny 高門檻|24–96|提高弱邊緣消失；降低雜訊多，與外部 Canny 分開|
|analysis.hough.param2|12|投票門檻|Hough 圓投票|8–20|提高更嚴格會漏淡波紋；降低更多假候選，目前保留12|
|analysis.hough.minRadius|8|分析 px|最小候選半徑|4–20|提高漏小波紋；降低小圈與計算增加|
|analysis.hough.maxRadius|80|分析 px|最大候選半徑|40–140|提高抓更大圈並更慢；降低漏大圈，必須大於 minRadius|
|analysis.radial.samples|72|個|圓周取樣數|36–144|提高較穩定但慢；降低可能漏局部弧|
|analysis.radial.radiusSearch|3|分析 px|半徑搜尋距離|1–6 整數|提高容錯但更慢且可能抓到鄰圈；降低更嚴格|
|analysis.radial.minGradient|8|梯度|最弱可接受梯度|4–24|提高抑制雜訊但淡弧消失；降低支援更多|
|analysis.radial.alignmentThreshold|0.65|0–1|徑向方向一致門檻|0.4–0.9|提高方向要求更嚴；降低容易接受背景|
|analysis.radial.keepThreshold|0.5|0–1|候選保留門檻|0.35–0.7|提高事件減少且可能漏淡波紋；降低事件增加|
|analysis.cluster.centerToleranceRatio|0.5|半徑比例|重複圓心容許距離|0.1–0.6|提高合併更多可能誤合併；降低重複較多|
|analysis.cluster.radiusToleranceRatio|0.2|半徑比例|重複半徑容差|0.05–0.25|提高可能誤吞同心不同圈；降低重複較多|
|analysis.cluster.minCenterTolerancePx|5|分析 px|小圈圓心容差下限|2–8|提高小圈易合併；降低小圈分開|
|analysis.cluster.minRadiusTolerancePx|3|分析 px|小圈半徑容差下限|1–5|提高小圈易合併；降低保留更多半徑|
|temporal.maxEvents|256|個|GPU 事件上限|16–256|提高保留更多但過去重建變慢；降低保留最高分事件，UI 顯示數量|
|temporal.strength|0.008|相對波高|照片當下的振幅倍率|0.005–0.06|提高扭曲和高光；降低更細微，不是物理公尺|
|temporal.decay|0.35|每秒|過去模型振幅衰減|0–1|提高往前回推的初始振幅更強；降低更均勻，回推有封頂|
|temporal.wavelength|0.025|圖寬比例|波包內波長|0.015–0.06|提高條紋變寬；降低細碎且可能欠取樣，至少約4個模擬px|
|temporal.packetWidth|0.025|圖寬比例|波包高斯寬度|0.01–0.08|提高多圈更寬；降低波包集中|
|temporal.birthFade|0.08|秒|撞擊後平滑出現時間|0.02–0.2|提高出現慢；降低接近突然出現|
|simulation.scale|0.5|顯示倍率|獨立波場解析度|0.2–0.75|提高波場精細但每步成本高；降低細波紋可能消失|
|simulation.speed|0.1|圖寬/秒|事件與未來波傳播速度|0.03–0.15|提高擴張快且需更小時間步；降低擴張慢並改變 age|
|simulation.fixedDt|0.005555555555555556|秒|固定模擬時間步|1/240–1/120，需通過 CFL|提高步長較快但可能不穩；降低較穩但回算更多步|
|simulation.damping|0.65|每秒|未來波動的速度阻尼|0–2|提高更快消散；降低更久，0近似無耗散|
|simulation.edgeWidth|0.04|圖寬比例|邊緣吸收帶|0–0.1|提高邊界較少反射但外圈消散快；降低邊界反射更明顯|
|simulation.edgeDamping|6|每秒|吸收帶額外阻尼|0–15|提高邊界波更快被吸收；降低更反射|
|simulation.stepsPerFrame|24|步|每次畫面最大回算步數|8–60|提高seek快但UI可能卡；降低較流暢但需等進度|
|render.displacement|0.001|圖寬比例/斜率|波場差分造成像素位移|0–0.01|提高扭曲；降低更接近照片，0停止位移|
|render.refraction|1|倍|位移折射倍率|0–3|提高折射位移；降低較靜，與 displacement 相乘|
|render.highlight|0.025|亮度|正斜率高光|0–0.3|提高亮邊更強；降低更自然|
|render.shadow|0.02|亮度|負斜率陰影|0–0.25|提高暗邊更強；降低較平|
|render.lightX|0.6|方向分量|光線水平分量|-1–1|提高偏右；降低偏左，與lightY共同決定|
|render.lightY|-0.8|方向分量|光線垂直分量|-1–1|提高偏下；降低偏上，兩分量不要同為0|
|render.debugGain|15|倍|波場與位移診斷放大|1–50|提高更易看也更易飽和；降低較暗，只影響 W/D|
|timeline.min|-2|秒|最早可回推時間|-5–0|提高可看過去變短；降低推測程度更高|
|timeline.max|4|秒|最遠未來時間|1–10|提高可看更久且seek較慢；降低範圍短|
|timeline.rate|1|時間倍率|播放速度，負值倒向播放|-2–2|提高時間走更快；降低慢動作，負值回算而非逆解阻尼|
|timeline.loop|True|開關|抵達邊界循環|true/false|開啟從另一端重播；關閉抵邊暫停|
|export.width|2160|px|PNG輸出寬|540–3375，受GPU上限限制|提高輸出細節及記憶體；降低較快|
|export.height|3840|px|PNG輸出高|960–6000，維持9:16|提高輸出細節及記憶體；降低較快|

## 調整順序

先用 H/R/C/V 驗證偵測，再用 W 看波場、D 看位移，最後用 F 調折射與明暗。先調 strength，再調 displacement，最後才是 highlight/shadow。每次只改一組。

CFL 穩定條件：speed × fixedDt × simulationWidth ≤ 1/√2。程式會拒絕不穩定設定，請降低 fixedDt 或 speed。模擬網格維持 canvas 比例，兩軸實際間距相等。

export 的尺寸只改最後照片重採樣的密度，不會提高事件或波場解析度。原始照片永久保持不變。
