#version 300 es
precision highp float;
// 離散波動：讀 current 的 R/G 與四鄰點，寫 next 的 R/G，之後交換兩張 texture。
// R 是現在、G 是上一固定步；laplacian 比較鄰居與自己，造成波自行傳播。
// uLambda=(speed*dt/dx)^2；必須 <=0.5。阻尼衰減速度，邊界另加吸收。
// 輸出不 clamp 波高，否則疊加會失真；必須用浮點 framebuffer。
in vec2 uv;out vec4 color;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uLambda,uDt,uDamping,uEdgeWidth,uEdgeDamping,uAspect;
vec2 state(vec2 p){return texture(uState,vec2(p.x,1.0-p.y)).rg;}
void main(){
    vec2 s=state(uv);
    float lap=state(uv+vec2(uTexel.x,0)).r+state(uv-vec2(uTexel.x,0)).r
        +state(uv+vec2(0,uTexel.y)).r+state(uv-vec2(0,uTexel.y)).r-4.0*s.r;
    float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y)*uAspect);
    float absorb=uEdgeWidth>0.0?1.0-smoothstep(0.0,uEdgeWidth,edge):0.0;
    float gamma=uDamping+absorb*uEdgeDamping;
    float next=(2.0*s.r-(1.0-gamma*uDt*0.5)*s.g+uLambda*lap)/(1.0+gamma*uDt*0.5);
    color=vec4(next,s.r,0,1);
}
