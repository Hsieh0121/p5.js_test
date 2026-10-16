// p5 主流程只負責載入、操作與顯示；偵測/事件/GPU 各有自己的檔案。
let img,analysisImg,grayImg,blurImg,gradientImg,edgeImg;
let houghCandidates=[],clusteredCandidates=[],rippleEvents=[];
let openCVProcessed=false,analysisAttempted=false,viewMode='source',engine=null;
let shaderSources={},targetTime=0,playing=false,readyAtTarget=true,lastTick=0,errorMessage='';
const viewKeys={s:'source',a:'analysis',g:'gray',b:'blur',m:'gradient',e:'edge',h:'hough',r:'radial',c:'cluster',v:'event',w:'wave',d:'displacement',f:'final'};
/** p5 preload等待照片及shader全部載入，缺檔會在狀態列明確提示，禁止默默用假資料。 */
function preload(){img=loadImage(CONFIG.source.path,()=>{},e=>fail('原始照片載入失敗'));for(const [name,file] of Object.entries({vertex:'fullscreen.vert',seed:'seed.frag',wave:'wave.frag',render:'render.frag'}))shaderSources[name]=loadStrings('shaders/'+file,()=>{},()=>fail('shader載入失敗：'+file));}
/** 建立獨立顯示畫布與UI；保持原本左上原點的debug畫法。 */
function setup(){pixelDensity(CONFIG.canvas.pixelDensity);const canvas=createCanvas(CONFIG.canvas.width,CONFIG.canvas.height);canvas.parent('canvas-host');buildAnalysisImage();setupControls();lastTick=performance.now();}
/** 保留原圖，只有複製品縮小。輸入img，輸出analysisImg；scale提高成本隨面積增加。 */
function buildAnalysisImage(){analysisImg=img.get();analysisImg.resize(Math.max(1,Math.floor(img.width*CONFIG.analysis.scale)),Math.max(1,Math.floor(img.height*CONFIG.analysis.scale)));}
/** UI失敗提示仍保留source/debug，避免一次GPU失敗導致整個畫面消失。 */
function fail(message){errorMessage=message;playing=false;console.error(message);}
/** 每幀：首次分析→推進目標時間→seek→渲染。回算中暫停播放時鐘，畫面標明真實進度。 */
function draw(){
    if(window.cvReady&&!analysisAttempted&&analysisImg){analysisAttempted=true;try{validateConfig();processAnalysisImage();openCVProcessed=true;rebuildEvents();}catch(e){fail('分析/初始化失敗：'+e.message);}}
    const now=performance.now(),dt=Math.min((now-lastTick)/1000,0.1);lastTick=now;
    if(playing&&engine&&readyAtTarget){targetTime+=dt*CONFIG.timeline.rate;if(targetTime>CONFIG.timeline.max||targetTime<CONFIG.timeline.min){if(CONFIG.timeline.loop)targetTime=CONFIG.timeline.rate>=0?CONFIG.timeline.min:CONFIG.timeline.max;else{targetTime=constrain(targetTime,CONFIG.timeline.min,CONFIG.timeline.max);playing=false;}}}
    if(engine)try{readyAtTarget=engine.seek(targetTime);}catch(e){fail(e.message);}
    background(20);
    const images={source:img,analysis:analysisImg,gray:grayImg,blur:blurImg,gradient:gradientImg,edge:edgeImg};
    if(images[viewMode])image(images[viewMode],0,0,width,height);
    else if(['wave','displacement','final'].includes(viewMode)&&engine){try{const c=engine.render(viewMode);drawingContext.drawImage(c,0,0,width,height);}catch(e){fail(e.message);}}
    else {image(img,0,0,width,height);if(['hough','radial','cluster','event'].includes(viewMode))drawCandidates();}
    document.getElementById('timeline').value=targetTime;
    document.getElementById('time-label').textContent=`目標 ${targetTime.toFixed(3)} s ｜畫面 ${(engine?.time||0).toFixed(3)} s ${readyAtTarget?'':'（回算中）'}`;
    document.getElementById('play').textContent=playing?'暫停':'播放';
    const state=errorMessage||window.cvError||(!window.cvReady?'正在載入 OpenCV…':!openCVProcessed?'正在分析…':`Hough ${houghCandidates.length} → radial ${houghCandidates.filter(c=>c.radialScore>=CONFIG.analysis.radial.keepThreshold).length} → clusters ${clusteredCandidates.length} → events ${rippleEvents.length}（上限 ${CONFIG.temporal.maxEvents}）｜波場 ${engine?.w||0}×${engine?.h||0}`);
    document.getElementById('status').textContent=state;
}
/** 分析結果轉事件後重建GPU；輸入clusters，輸出engine。只在資料/設定變更時做，不逐幀偵測。 */
function rebuildEvents(){clusteredCandidates=clusterCandidates(houghCandidates.filter(c=>c.radialScore>=CONFIG.analysis.radial.keepThreshold),analysisImg.width,analysisImg.height);rippleEvents=buildEvents(clusteredCandidates);engine?.dispose();engine=null;targetTime=0;playing=false;engine=new WaveSimulation(img,rippleEvents,Object.fromEntries(Object.entries(shaderSources).map(([k,v])=>[k,Array.isArray(v)?v.join('\n'):v])));readyAtTarget=true;}
/** 圓只在診斷圖出現：輸入幾何/分數，輸出overlay；不參與最後F畫面或wave方程。
 * radius乘寬；y乘高。若畫布不是照片比例，影像與圓都會變形，請維持9:16。
 */
function drawCandidates(){let list=houghCandidates;if(viewMode==='radial')list=list.filter(c=>c.radialScore>=CONFIG.analysis.radial.keepThreshold);if(viewMode==='cluster')list=clusteredCandidates;if(viewMode==='event')list=rippleEvents;push();noFill();for(const c of list){const x=c.x*width,y=c.y*height,r=c.radius*width;stroke(viewMode==='cluster'?255:0,255,viewMode==='event'?80:255);strokeWeight(viewMode==='hough'?2:1+4*c.radialScore);circle(x,y,r*2);line(x-4,y,x+4,y);line(x,y-4,x,y+4);if(viewMode==='event'){noStroke();fill(255);textSize(14);text(`#${c.id} ${(c.confidence*100).toFixed(0)}% / ${c.detectionMembers}候選`,x+7,y-7);noFill();}}pop();}
/** 鍵盤保持原有S/A/G/B/M/E/H/R，擴充C/V/W/D/F；文字輸入框操作時不攔截。 */
function keyPressed(event){if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(viewKeys[key.toLowerCase()]){viewMode=viewKeys[key.toLowerCase()];document.getElementById('view').value=viewMode;}if(key===' '){playing=!playing;event?.preventDefault();}if(key==='0'){targetTime=0;playing=false;}}
/** 綁定明確的時間及匯出控制；設定按鈕會做範圍檢查並重新分析，不覆寫照片。 */
function setupControls(){
    const slider=document.getElementById('timeline');slider.min=CONFIG.timeline.min;slider.max=CONFIG.timeline.max;
    slider.oninput=()=>{targetTime=Number(slider.value);playing=false;};
    document.getElementById('view').onchange=e=>viewMode=e.target.value;
    document.getElementById('play').onclick=()=>playing=!playing;
    document.getElementById('reset').onclick=()=>{targetTime=0;playing=false;};
    document.getElementById('direction').onchange=e=>CONFIG.timeline.rate=Number(e.target.value);
    document.getElementById('apply').onclick=()=>{try{validateConfig();playing=false;errorMessage='';engine?.dispose();engine=null;resizeCanvas(CONFIG.canvas.width,CONFIG.canvas.height);pixelDensity(CONFIG.canvas.pixelDensity);buildAnalysisImage();analysisAttempted=false;openCVProcessed=false;slider.min=CONFIG.timeline.min;slider.max=CONFIG.timeline.max;}catch(e){fail(e.message);}};
    document.getElementById('export').onclick=exportImage;
    document.getElementById('events').onclick=()=>downloadBlob(new Blob([JSON.stringify({schemaVersion:1,coordinateSystem:'x/width,y/height,radius/width',events:rippleEvents},null,2)],{type:'application/json'}),'raindrop-events.json');
}
/** 檢查數值、核大小及時間範圍，避免非法值直接傳給OpenCV或GPU。 */
function validateConfig(){
    function visit(obj,path='CONFIG'){for(const [k,v] of Object.entries(obj)){if(typeof v==='object')visit(v,path+'.'+k);else if(typeof v==='number'&&!Number.isFinite(v))throw Error(path+'.'+k+' 必須是有限數字');}}
    visit(CONFIG);
    const a=CONFIG.analysis,s=CONFIG.simulation,t=CONFIG.temporal;
    for(const [v,name] of [[a.blurKernel,'blurKernel'],[a.sobelKernel,'sobelKernel']])if(!Number.isInteger(v)||v<1||v%2!==1)throw Error(name+' 必須為正奇數');
    if(![3,5,7].includes(a.sobelKernel))throw Error('sobelKernel 請使用3/5/7');
    if(a.scale<=0||a.scale>1||s.scale<=0||s.fixedDt<=0||s.speed<=0||t.wavelength<=0||t.packetWidth<=0||t.birthFade<=0)throw Error('解析度倍率、時間步、速度及波長/寬度/出現時間必須大於0');
    if(!Number.isInteger(t.maxEvents)||t.maxEvents<1||t.maxEvents>256||!Number.isInteger(s.stepsPerFrame)||s.stepsPerFrame<1)throw Error('maxEvents需1–256整數；stepsPerFrame需正整數');
    if(a.hough.minRadius<0||a.hough.maxRadius<=a.hough.minRadius||a.hough.dp<1||a.hough.minDist<=0||a.hough.param1<=0||a.hough.param2<=0||a.cannyLow<0||a.cannyHigh<a.cannyLow)throw Error('請檢查Hough/Canny的正數與大小關係');
    if(a.radial.samples<1||!Number.isInteger(a.radial.samples)||a.radial.radiusSearch<0||!Number.isInteger(a.radial.radiusSearch))throw Error('radial取樣需正整數，搜尋距離需非負整數');
    for(const v of [a.radial.keepThreshold,a.radial.alignmentThreshold])if(v<0||v>1)throw Error('radial門檻需0–1');
    for(const v of [a.cluster.centerToleranceRatio,a.cluster.radiusToleranceRatio,a.cluster.minCenterTolerancePx,a.cluster.minRadiusTolerancePx,s.damping,s.edgeWidth,s.edgeDamping,t.strength,t.decay])if(v<0)throw Error('容差、阻尼、強度、衰減不得為負');
    for(const v of [CONFIG.canvas.width,CONFIG.canvas.height,CONFIG.export.width,CONFIG.export.height,CONFIG.canvas.pixelDensity])if(!Number.isInteger(v)||v<1)throw Error('畫布/輸出尺寸與密度需正整數');
    if(CONFIG.timeline.min>0||CONFIG.timeline.max<=0)throw Error('timeline.min需≤0，max需>0');
}
/** 下載產生的資料，不修改任何來源檔案；完成後釋放暫時URL。 */
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/** 匯出已到位的時間為高解析PNG；不拉高波場解析度。回算中禁止匯出錯誤時間。
 * 瀏覽器編碼完成後恢復預覽尺寸，輸出仍直接採樣原始3375×6000照片texture。
 */
function exportImage(){if(!engine||!readyAtTarget){fail('請等待時間回算完成後再匯出');return;}playing=false;try{const currentEngine=engine,exportTime=engine.time;const c=engine.render('final',CONFIG.export.width,CONFIG.export.height);c.toBlob(blob=>{if(blob)downloadBlob(blob,`raindrop_${exportTime.toFixed(3)}s.png`);else fail('PNG編碼失敗');if(engine===currentEngine)engine.render(viewMode);},'image/png');}catch(e){fail(e.message);}}
