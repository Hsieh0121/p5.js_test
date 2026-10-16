/** GPU 波場與渲染器。接收原圖、RippleEvent[]、shader 文字。
 * 使用獨立 WebGL2 canvas，p5 保持原本 2D debug 畫法；功能等同浮點 framebuffer ping-pong。
 * 這樣不用把原有 image()/circle() 的座標全部換成 WebGL 中心原點。
 * A/B 各儲存「現在及上一固定步」，reference 永遠儲存照片當下；三張低解析浮點 texture。
 * 所有對照片的變化發生在 render.frag 的 texture 取樣；完全不更改 source。
 * 若 GPU 不支援浮點渲染，拋出可讀錯誤，保留 p5 分析畫面。
 */
class WaveSimulation {
    constructor(photo, events, sources) {
        this.canvas=document.createElement('canvas');
        this.canvas.width=CONFIG.canvas.width;this.canvas.height=CONFIG.canvas.height;
        this.gl=this.canvas.getContext('webgl2',{preserveDrawingBuffer:true,antialias:false});
        const gl=this.gl;
        if(!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('需要支援 WebGL2 與浮點波場的瀏覽器/GPU。');
        this.w=Math.max(8,Math.round(CONFIG.canvas.width*CONFIG.simulation.scale));
        this.h=Math.max(8,Math.round(this.w*CONFIG.canvas.height/CONFIG.canvas.width));
        this.aspect=this.h/this.w;
        const max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if(Math.max(this.w,this.h,photo.width,photo.height)>max) throw Error('圖片或波場超過此 GPU texture 尺寸上限：'+max);
        const cfl=CONFIG.simulation.speed*CONFIG.simulation.fixedDt*this.w;
        if(cfl>Math.SQRT1_2) throw Error('波動不穩定：請降低 speed、fixedDt 或 simulation.scale（CFL='+cfl.toFixed(3)+'）。');
        this.seedProgram=this.program(sources.vertex,sources.seed);
        this.waveProgram=this.program(sources.vertex,sources.wave);
        this.renderProgram=this.program(sources.vertex,sources.render);
        this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
        this.a=this.target();this.b=this.target();this.reference=this.target();
        this.photo=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.photo);
        this.textureOptions(gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,photo.canvas);
        const data=new Float32Array(8*Math.max(events.length,1));
        events.forEach((e,i)=>data.set([e.x,e.y,e.radius,e.strength,e.velocity,e.decay,e.impactTime,e.phase],i*8));
        this.events=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.events);this.textureOptions(gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,2,Math.max(1,events.length),0,gl.RGBA,gl.FLOAT,data);
        this.count=events.length;
        this.seed(this.reference,0);this.seed(this.a,0);this.stepIndex=0;this.time=0;this.past=false;
    }
    /** 編譯 vertex+fragment→GPU program；輸入shader原文，輸出program，失敗包含驅動錯誤。 */
    program(vertex,fragment){
        const g=this.gl,p=g.createProgram();
        for(const [type,src] of [[g.VERTEX_SHADER,vertex],[g.FRAGMENT_SHADER,fragment]]){
            const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);
            if(!g.getShaderParameter(s,g.COMPILE_STATUS)) {const error=g.getShaderInfoLog(s);g.deleteShader(s);throw Error(error);}
            g.attachShader(p,s);g.deleteShader(s);
        }
        g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;
    }
    /** 統一 texture 邊界/過濾。浮點場用 NEAREST，避免需要另一個浮點線性過濾擴充。 */
    textureOptions(filter){const g=this.gl;for(const k of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,k,filter);for(const k of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,k,g.CLAMP_TO_EDGE);}
    /** 分配一張 RGBA32F texture 與接收它的 framebuffer；檢查GPU真的可寫入。 */
    target(){const g=this.gl,texture=g.createTexture(),fb=g.createFramebuffer();g.bindTexture(g.TEXTURE_2D,texture);this.textureOptions(g.NEAREST);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,this.w,this.h,0,g.RGBA,g.FLOAT,null);g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('浮點 framebuffer 建立失敗');return {texture,fb};}
    /** 每次pass選擇program/輸出尺寸；輸出到低解析場或最終高解析canvas。 */
    begin(program,target){const g=this.gl;this.active=program;g.useProgram(program);g.bindVertexArray(this.vao);g.bindFramebuffer(g.FRAMEBUFFER,target?target.fb:null);g.viewport(0,0,target?this.w:this.canvas.width,target?this.h:this.canvas.height);}
    /** 以名字傳參數：int供sampler/count/mode，vec2供像素步距，其餘為float。 */
    uniform(name,value,int=false){const g=this.gl,l=g.getUniformLocation(this.active,name);if(Array.isArray(value))g.uniform2fv(l,value);else if(int)g.uniform1i(l,value);else g.uniform1f(l,value);}
    /** 將texture接到指定GPU槽，sampler便能讀取；同一次pass不讀正在寫的texture。 */
    bind(name,texture,unit){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);this.uniform(name,unit,true);}
    /** 事件解析式→target 的 R/G。負時間和初始條件共用，同樣形狀避免穿越0跳接。 */
    seed(target,time){this.begin(this.seedProgram,target);this.bind('uEvents',this.events,0);this.uniform('uCount',this.count,true);this.uniform('uTime',time);this.uniform('uDt',CONFIG.simulation.fixedDt);this.uniform('uAspect',this.aspect);this.uniform('uWavelength',CONFIG.temporal.wavelength);this.uniform('uWidth',CONFIG.temporal.packetWidth);this.uniform('uBirth',CONFIG.temporal.birthFade);this.gl.drawArrays(this.gl.TRIANGLES,0,3);}
    /** 正時間固定步前進：A→B後交換，決不原地覆寫正在讀的狀態。 */
    step(){const c=CONFIG.simulation;this.begin(this.waveProgram,this.b);this.bind('uState',this.a.texture,0);this.uniform('uTexel',[1/this.w,1/this.h]);this.uniform('uLambda',(c.speed*c.fixedDt*this.w)**2);this.uniform('uDt',c.fixedDt);this.uniform('uDamping',c.damping);this.uniform('uEdgeWidth',c.edgeWidth);this.uniform('uEdgeDamping',c.edgeDamping);this.uniform('uAspect',this.aspect);this.gl.drawArrays(this.gl.TRIANGLES,0,3);[this.a,this.b]=[this.b,this.a];this.stepIndex++;this.time=this.stepIndex*c.fixedDt;}
    /** seek支援任意拖曳：負時間直接seed；向後跳則從0重算，避免反轉有耗散的方程。
     * 每幀最多stepsPerFrame步，回傳是否到位；UI區分目標與實際時間，等待不會冒充完成。
     */
    seek(time,budget=CONFIG.simulation.stepsPerFrame){
        if(time<0){if(this.past&&this.time===time)return true;this.seed(this.a,time);this.time=time;this.past=true;return true;}
        const goal=Math.round(time/CONFIG.simulation.fixedDt);
        if(this.past||goal<this.stepIndex){this.seed(this.a,0);this.stepIndex=0;this.time=0;this.past=false;}
        for(let n=0;n<budget&&this.stepIndex<goal;n++)this.step();
        return this.stepIndex===goal;
    }
    /** 波場→照片重採樣。mode切換不影響模擬；尺寸只影響最終輸出，非波場密度。 */
    render(mode='final',width=CONFIG.canvas.width,height=CONFIG.canvas.height){
        const g=this.gl,max=Math.min(g.getParameter(g.MAX_TEXTURE_SIZE),...g.getParameter(g.MAX_VIEWPORT_DIMS));
        if(width>max||height>max)throw Error('輸出尺寸超過 GPU 上限 '+max);
        if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
        const c=CONFIG.render;this.begin(this.renderProgram,null);this.bind('uPhoto',this.photo,0);this.bind('uState',this.a.texture,1);this.bind('uReference',this.reference.texture,2);
        this.uniform('uTexel',[1/this.w,1/this.h]);this.uniform('uDx',1/this.w);this.uniform('uAspect',this.aspect);this.uniform('uLight',[c.lightX,c.lightY]);this.uniform('uDisplacement',c.displacement);this.uniform('uRefraction',c.refraction);this.uniform('uHighlight',c.highlight);this.uniform('uShadow',c.shadow);this.uniform('uGain',c.debugGain);this.uniform('uMode',mode==='wave'?1:mode==='displacement'?2:0,true);g.drawArrays(g.TRIANGLES,0,3);return this.canvas;
    }
    /** 設定重建時釋放GPU資源，避免多次套用後記憶體累積。 */
    dispose(){const g=this.gl;for(const t of [this.a,this.b,this.reference]){g.deleteTexture(t.texture);g.deleteFramebuffer(t.fb);}g.deleteTexture(this.photo);g.deleteTexture(this.events);for(const p of [this.seedProgram,this.waveProgram,this.renderProgram])g.deleteProgram(p);g.deleteVertexArray(this.vao);g.getExtension('WEBGL_lose_context')?.loseContext();}
}
