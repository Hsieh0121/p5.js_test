# 從照片證據到可能時間：學習指南

閱讀順序：先用 S/H/R/C/V 看懂偵測，再用 W 看波場、D 看位移，最後看 F。不要只看最後影像，因為任何一層的錯誤都可能看起來像「效果參數不夠好」。

## 1. 照片如何進入分析

`sketch.js::preload()` 輸入檔案路徑，輸出 p5.Image 和四份shader文字。p5會等載入結束才呼叫setup；照片缺失時應先修路徑，不要調偵測參數。

`setup()` 建立顯示canvas、複製分析圖並綁定介面。`buildAnalysisImage()` 透過 img.get() 複製，再resize複製品；原圖從未resize。analysis.scale越大，分析越精細也越慢。

`imageAnalysis.js::processAnalysisImage()` 用analysisImg.loadPixels()取得RGBA陣列，包成ImageData交給cv.matFromImageData。p5.Image是方便顯示的圖片物件，Mat則是OpenCV的像素矩陣及型別資訊。OpenCV在WebAssembly記憶體裡工作，不會自動隨JavaScript變數消失；本函式用own()記錄每張Mat，finally逐張delete，連出錯也釋放。

輸出是grayImg、blurImg、gradientImg、edgeImg及houghCandidates。要顯示灰階Mat，先轉RGBA，再用pixels.set複製到p5.Image，最後updatePixels。這個轉換只做一次，不必每幀重算。

## 2. 灰階、模糊與方向

灰階把顏色轉成亮度，讓辨識聚焦在結構；沒有丟掉source彩色照片。GaussianBlur用附近像素平均抑制細小顆粒，blurKernel越大，噪點少但淡弧可能消失。

Sobel分別計算gradX與gradY：水平、垂直亮度改變多少。向量有正負方向，所以不能先取絕對值再拿去做徑向判斷。gradient debug才使用convertScaleAbs與addWeighted，這張診斷圖不等同精確的sqrt(gx²+gy²)。

Canny輸出強邊緣及與其連通的弱邊緣，只供E診斷。調cannyLow/high不會改Hough結果：Hough本身另用param1內部邊緣門檻。這是初學時容易混淆的地方。

## 3. 圓候選不是事件真相

HoughCircles輸入blurred Mat，輸出圈的x/y/r。param2=12故意寬鬆，讓淡波紋進入候選，而非只保留完整圓。minDist控制候選圓心最小距離，與後面cluster容差會互相影響。

`scoreRadialCandidate(candidate, gradX, gradY)` 沿圓周取samples個點，各點在半徑±radiusSearch內找最強gradient，使用絕對內積判斷梯度是否大致朝向圓心。內積接近1代表一致，接近0代表垂直。明暗翻轉仍合理，所以取絕對值。

support是有足夠梯度的樣本比例；alignment是過方向門檻者的內積總和，除以所有受支援樣本數（未過門檻者貢獻0）；score=alignment×sqrt(support)。它衡量視覺證據，不能解讀為「90%確定有雨滴」。R會篩去低於keepThreshold者，線粗代表score，不是透明度。

## 4. 為什麼要兩種距離一起cluster

`clusterCandidates(candidates,width,height)` 輸入篩選後圓，輸出合併圓。先按score排序，把最高分當群anchor。新候選與anchor的圓心及半徑都足夠接近才能加入，避免30/32/34與同心65混在一起。

比較圓心時，x乘分析寬、y乘分析高，回到同單位的像素，再算距離。若直接在0–1座標算距離，9:16照片的水平與垂直會被錯當相同長度。

合併結果以score加權平均x/y/r及分數，保留最高分peakConfidence與detectionMembers。孤立候選不會因群太小就刪除，弱波紋仍有機會進事件層。容差太小會沒有任何合併；太大則會把不同事件誤合併。固定anchor避免連鎖相接吃掉一大片。

## 5. normalized座標與事件接口

`buildEvents(clusters)` 只讀一般JavaScript物件，不碰cv.Mat，輸出純資料RippleEvent[]。x=像素x/圖寬，y=像素y/圖高，radius=像素半徑/圖寬。radius不是除以圖高。

每個事件有id、x/y/radius、strength、confidence、radialScore/support/alignment、detectionMembers、peakConfidence、velocity、decay、phase、impactTime。strength=整體強度×score。velocity以圖寬/秒計；impactTime=-radius/velocity，表示假定以固定波速擴張，照片已是在撞擊後。phase=radius/wavelength記錄已經走過幾個波長；seed實際用radius和impactTime決定波形，phase是可讀的衍生資料。

未來要手動加入事件，只要建立同樣格式，再重建WaveSimulation，無須重寫OpenCV。JSON匯出會附座標規則與schemaVersion；目前沒有JSON匯入介面。

## 6. WebGL、shader與framebuffer

WebGL讓GPU同時替每個像素算相同的程式。vertex shader只負責一個覆蓋畫面的三角形，fragment shader負責每個像素的顏色或波高。本專案用原生WebGL2的離屏canvas，最後由p5的drawingContext.drawImage顯示，原來的debug仍用2D座標。

`WaveSimulation.constructor(photo,events,sources)` 檢查GPU擴充、texture尺寸與CFL，再編譯shader並分配資源。輸入照片與事件，不讀Hough。輸出可seek/render的引擎。simulation.scale決定網格，與照片texture解析度獨立。

`program(vertex,fragment)` 編譯並連結shader，失敗拋出GPU訊息；`textureOptions(filter)` 設定過濾及邊界。照片用LINEAR，波場用NEAREST，避免依賴浮點線性過濾擴充。`target()` 分配RGBA32F texture及framebuffer，並檢查可寫入。framebuffer可以想成GPU畫畫的畫紙；texture是能讓下一道shader讀回的畫紙內容。

`begin(program,target)` 選擇本次使用的shader與畫紙、viewport尺寸；`uniform(name,value,int)` 把CONFIG中的數字交給shader；`bind(name,texture,unit)` 把texture接到指定槽位。uniform只適合少量參數，全部事件則打包成2×事件數的浮點texture，避開uniform陣列上限。

照片資料的UV以左上(0,0)為原點，framebuffer儲存以左下為原點。fullscreen.vert輸出照片座標，wave/render讀浮點texture時把y翻回來。漏掉這個轉換會讓圈和照片上下顛倒。

## 7. 照片當下如何變成波高

`seed(target,time)` 呼叫seed.frag，把每個事件轉成連續波包。輸入事件texture、time與波形參數，輸出R=height(t)、G=height(t-dt)。

seed.frag用age=time-impactTime；age<0代表這條假設還沒撞擊，所以貢獻0。r=velocity×age得到向外走的中心半徑。每個像素距圓心的距離d，減去r得到q；cos(2πq/wavelength)形成正負波高，高斯包絡exp(-q²/(2×packetWidth²))讓波只集中在附近。

strength控制高度，decay控制時間衰減；回推振幅最多乘exp(2)，避免非常早的推測爆炸。birthFade讓撞擊後平滑出現。這些是藝術波包，不能當成真實水面重建。過去每次都直接算height(time)，不倒解有阻尼的波動。

reference target永遠seed在t=0，與照片基準對應；A也seed在0，後續才演化。兩者起始值完全相同。

## 8. 正時間的離散波動

`step()` 讀A寫B，交換A/B。A的R是現在高度，G是上一時間步。wave.frag讀上下左右四個R，加起來減4×自己，得到離散laplacian，表示此點與鄰居的高低差。這個差驅動波往外傳。

無阻尼時核心為next=2×current-previous+lambda×laplacian，lambda=(speed×dt/dx)²。加入速度阻尼後，分子與分母都有gamma×dt/2；gamma越大，振動越快消失。邊緣還會額外吸收，減少碰到邊界反射。它是線性波動，不是粒子圓圈動畫。

dx=1/simulationWidth，以圖寬為單位；高度依相同比例分配，所以兩軸像素間距相同。穩定條件speed×dt/dx≤1/√2，不遵守就可能爆成噪點。constructor會拒絕設定，請減小fixedDt或speed。

`seek(time,budget)` 若time<0，直接seed可能歷史；若正時間往後，step固定次數；若往回跳正時間，重置到0再前算。每次最多stepsPerFrame步，回傳是否到位。這讓同一時間的結果不依播放幀率改變；時間會四捨五入到最近fixedDt，UI顯示實際時間。反向播放較慢是回算的代價。

## 9. 從波場變成照片像素

`render(mode,width,height)` 只讀目前波場、reference與原照片。render.frag先做delta=height(time)-height(0)，中央差分得到x/y斜率。位移=斜率×displacement×refraction；y還要除aspect，換回UV。

原本的texture(photo,uv)改成texture(photo,uv+shift)，所以是真正移動照片取樣。超出邊界的UV會clamp，極強參數可能拉伸邊緣。

亮暗用斜率與light方向內積近似，正值加highlight，負值減shadow。這是水面法線反應的簡化，不是完整折射方程；數值太大會白邊、黑邊與果凍感。先降strength，再減displacement，最後調亮暗。

W顯示絕對波高，紅/藍代表正負，灰代表0；D顯示相對reference的斜率差，0時為灰。F只顯示照片重採樣結果，沒有circle()。t=0時delta與斜率均為0，因此F與原照片一致。

## 10. 控制、匯出、錯誤與清理

`draw()` 是調度器：等待cvReady，只分析一次；更新timeline；seek到目標；顯示debug或final。回算未完成時停止累加播放時間，避免永遠追不上。`rebuildEvents()` 將目前分析轉cluster/event，再重建引擎。

`drawCandidates()` 只在H/R/C/V畫圓心與半徑，V還加confidence和成員數；不影響波場。`keyPressed()` 保留快捷鍵並避免文字輸入框誤觸。`setupControls()` 綁定播放、重設、方向、套用與匯出。

`validateConfig()` 避免非數字、非法核、負阻尼、錯誤尺寸進入依賴；真正的CFL及GPU上限在引擎再驗證。`fail(message)` 顯示錯誤並停播放，source/debug仍可檢查。套用有效設定可清除錯誤後重建。

`exportImage()` 等seek到位後，將最終canvas切成export尺寸重採樣原照片，再toBlob輸出PNG。它不會重跑高解析模擬；需要更細的波時調simulation.scale並重建。`downloadBlob()` 只建立暫時下載連結，下載後回收URL。JSON下載保留事件參數供研究。

`dispose()` 刪除浮點texture、framebuffer、program、VAO並釋放離屏context；套用設定時先清理舊引擎，避免長時間調參後累積GPU記憶體。

## 建議實驗

先只改radial.keepThreshold，比R/V的差別。再改cluster.radiusToleranceRatio，檢查同心不同半徑是否仍保留。回到原值後用W觀察阻尼0與0.65的差別，再用D/F比較displacement=0與0.001。每次記錄時間、參數及PNG，避免在不同時間比較兩組設定。
