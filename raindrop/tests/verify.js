// 在真正的瀏覽器/GPU驗證數學與資源路徑，不以偽造GPU代替。測試只產生離屏資料。
(async()=>{
const list=document.querySelector('#results');let failures=0;
function check(name,ok,detail=''){const li=document.createElement('li');li.textContent=(ok?'通過':'失敗')+'：'+name+' '+detail;list.append(li);if(!ok)failures++;}
let engine;
try{
const c=(x,y,r,s=.7)=>({x,y,radius:r,radialScore:s,radialSupport:.8,radialAlignment:.8});
const clusters=clusterCandidates([c(.3,.3,.05),c(.302,.302,.052),c(.3,.3,.12),c(.8,.8,.04,.51)],675,1200);
check('只合併圓心與半徑皆相近者，保留同心不同圈與弱孤立候選',clusters.length===3&&clusters.some(c=>c.detectionMembers===2)&&clusters.some(c=>c.radialScore===.51));
const events=buildEvents(clusters);
check('事件座標與撞擊時間尺度',events.every(e=>e.x>=0&&e.x<=1&&e.y>=0&&e.y<=1&&Math.abs(e.impactTime*e.velocity+e.radius)<1e-8));
const names={vertex:'fullscreen.vert',seed:'seed.frag',wave:'wave.frag',render:'render.frag'},sources={};
await Promise.all(Object.entries(names).map(async([k,v])=>sources[k]=await (await fetch('../shaders/'+v)).text()));
const image=new Image();image.src='../assets/raindrop.JPG';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);
check('原始照片尺寸',image.naturalWidth===3375&&image.naturalHeight===6000,`${image.naturalWidth}×${image.naturalHeight}`);
engine=new WaveSimulation({canvas,width:canvas.width,height:canvas.height},events,sources);
const g=engine.gl;
function field(){g.bindFramebuffer(g.FRAMEBUFFER,engine.a.fb);const a=new Float32Array(engine.w*engine.h*4);g.readPixels(0,0,engine.w,engine.h,g.RGBA,g.FLOAT,a);return a;}
function pixels(){const a=new Uint8Array(128*228*4);g.readPixels(0,0,128,228,g.RGBA,g.UNSIGNED_BYTE,a);return a;}
function diff(a,b){return a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0);}
engine.render('final',128,228);const t0=pixels();const opts={...CONFIG.render};CONFIG.render.displacement=0;CONFIG.render.highlight=0;CONFIG.render.shadow=0;engine.render('final',128,228);check('t=0與不帶光學變形的原圖採樣完全相同',diff(t0,pixels())===0);Object.assign(CONFIG.render,opts);
const initial=field();engine.seek(.3,10000);const future=field();
check('正時間波場變化且全部為有限數值',diff(initial,future)>0&&future.every(Number.isFinite));
engine.seek(.1,10000);engine.seek(.3,10000);check('正時間任意往回seek後重算結果一致',diff(future,field())===0);
engine.seek(-.3);const past=field();engine.seek(.3,10000);engine.seek(-.3);check('過去重建不依賴之前的播放路徑',diff(past,field())===0);
engine.seek(.3,10000);engine.render('final',128,228);check('未來真正改變照片取樣/明暗',diff(t0,pixels())>100);
engine.render('final',CONFIG.export.width,CONFIG.export.height);const blob=await new Promise(resolve=>engine.canvas.toBlob(resolve,'image/png'));const bitmap=await createImageBitmap(blob);check('高解析PNG成功編碼',bitmap.width===2160&&bitmap.height===3840,`${bitmap.width}×${bitmap.height}, ${blob.size} bytes`);bitmap.close();
check('GPU沒有錯誤',g.getError()===g.NO_ERROR);
engine.dispose();engine=null;
const oldSpeed=CONFIG.simulation.speed;CONFIG.simulation.speed=100;let rejected=false;try{new WaveSimulation({canvas,width:canvas.width,height:canvas.height},[],sources);}catch(e){rejected=/CFL/.test(e.message);}CONFIG.simulation.speed=oldSpeed;check('不穩定CFL被拒絕',rejected);
}catch(e){check('驗證執行',false,e.stack);}finally{engine?.dispose();document.querySelector('#progress').textContent=failures?`${failures}項失敗`:'全部通過';}
})();
