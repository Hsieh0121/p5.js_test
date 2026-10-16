#version 300 es
precision highp float;
// 最後像素重採樣：輸入原圖、目前波場、t=0參考波場；輸出彩色影像。
// 差分場=現在-照片當下，令 t=0 的位移與明暗都精確為零。
// 中央差分求斜率，類似水面法線的水平分量；它改變照片取樣位置而非畫圓。
// 高光/陰影是方向性藝術近似，並非完整 Fresnel 或光線追蹤。
// mode 1=wave；2=displacement；0=final。照片採左上 UV，浮點場採下方原點。
in vec2 uv;out vec4 color;
uniform sampler2D uPhoto,uState,uReference;
uniform vec2 uTexel,uLight;
uniform float uDx,uDisplacement,uRefraction,uHighlight,uShadow,uGain,uAspect;
uniform int uMode;
float field(sampler2D tex,vec2 p){return texture(tex,vec2(p.x,1.0-p.y)).r;}
float delta(vec2 p){return field(uState,p)-field(uReference,p);}
void main(){
    vec2 g=vec2(delta(uv+vec2(uTexel.x,0))-delta(uv-vec2(uTexel.x,0)),
                delta(uv+vec2(0,uTexel.y))-delta(uv-vec2(0,uTexel.y)))/(2.0*uDx);
    if(uMode==1){float h=field(uState,uv)*uGain; color=vec4(vec3(0.5)+vec3(h,-abs(h)*0.4,-h),1);return;}
    if(uMode==2){color=vec4(clamp(vec3(0.5+g*uGain*0.02,0.5),0.0,1.0),1);return;}
    vec2 shift=g*uDisplacement*uRefraction*vec2(1.0,1.0/uAspect);
    vec3 photo=texture(uPhoto,clamp(uv+shift,vec2(0),vec2(1))).rgb;
    float lighting=dot(g,normalize(uLight+vec2(0.000001)));
    photo+=uHighlight*max(lighting,0.0)-uShadow*max(-lighting,0.0);
    color=vec4(clamp(photo,0.0,1.0),1);
}
