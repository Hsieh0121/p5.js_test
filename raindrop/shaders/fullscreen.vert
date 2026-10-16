#version 300 es
// 全畫面三角形：輸入 gl_VertexID，輸出左上為(0,0)的照片座標。
// 不需要模型、相機或透視。過大的單一三角形覆蓋整張 framebuffer。
out vec2 uv;
void main(){
    vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
    uv=vec2(p.x,1.0-p.y);
    gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}
