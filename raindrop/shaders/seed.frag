#version 300 es
precision highp float;
// 事件→波場初始條件／可能過去。events texture 每個事件占兩個 RGBA pixel。
// 輸入：事件、時間、波包寬/波長。輸出 R=目前波高，G=前一時間步波高。
// 過去直接重新評估，沒有把阻尼倒過來。t=0 seed 也是未來的初始條件。
// 因 r/v 推出 impactTime，在撞擊之前為零；birthFade 防止瞬間跳出。
in vec2 uv; out vec4 color;
uniform sampler2D uEvents;
uniform int uCount;
uniform float uTime,uDt,uAspect,uWavelength,uWidth,uBirth;
float heightAt(float t){
    float h=0.0;
    for(int i=0;i<uCount;i++){
        vec4 e=texelFetch(uEvents,ivec2(0,i),0);
        vec4 m=texelFetch(uEvents,ivec2(1,i),0);
        float age=t-m.z;
        if(age<0.0) continue;
        float r=m.x*age;
        float d=length((uv-e.xy)*vec2(1.0,uAspect));
        float q=d-r;
        float envelope=exp(-0.5*q*q/(uWidth*uWidth));
        float amp=e.w*exp(clamp(-m.y*t,-8.0,2.0));
        h+=amp*envelope*cos(6.28318530718*q/uWavelength)*smoothstep(0.0,uBirth,age);
    }
    return h;
}
void main(){color=vec4(heightAt(uTime),heightAt(uTime-uDt),0,1);}
