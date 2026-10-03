let font;
let mask;
let softMask;
let jellyShader;

let word = "Dorobou";
let fontSize = 300;

let purple;
let lightPurple;

// ================================
// Vertex Shader
// ================================

const vert = `
precision mediump float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vTexCoord;

void main() {

  vTexCoord = aTexCoord;

  gl_Position =
    uProjectionMatrix *
    uModelViewMatrix *
    vec4(aPosition, 1.0);
}
`;

// ================================
// Fragment Shader
// ================================

const frag = `
precision mediump float;

varying vec2 vTexCoord;

uniform sampler2D uMask;
uniform sampler2D uSoftMask;

uniform vec2 uTexel;
uniform float uTime;

void main() {

  vec2 uv = vTexCoord;


  // ================================
  // 1. 整塊文字的波動
  // ================================

  float waveX =
      sin(uv.y * 9.0 + uTime * 1.5) * 0.012
    + sin(uv.y * 4.0 - uTime * 0.8) * 0.006;

  float waveY =
      sin(uv.x * 7.0 + uTime * 1.1) * 0.006;

  uv += vec2(waveX, waveY);


  // ================================
  // 2. 讀取字形
  // ================================

  float maskValue =
    texture2D(uMask, uv).a;

  float soft =
    texture2D(uSoftMask, uv).a;

  float alpha =
    smoothstep(
      0.05,
      0.95,
      maskValue
    );


  // ================================
  // 3. 偵測表面的坡度
  // ================================

  float sampleDistance = 5.0;

  float left =
    texture2D(
      uSoftMask,
      uv - vec2(
        uTexel.x * sampleDistance,
        0.0
      )
    ).a;

  float right =
    texture2D(
      uSoftMask,
      uv + vec2(
        uTexel.x * sampleDistance,
        0.0
      )
    ).a;

  float top =
    texture2D(
      uSoftMask,
      uv - vec2(
        0.0,
        uTexel.y * sampleDistance
      )
    ).a;

  float bottom =
    texture2D(
      uSoftMask,
      uv + vec2(
        0.0,
        uTexel.y * sampleDistance
      )
    ).a;


  float dx = right - left;
  float dy = bottom - top;


  // ================================
  // 4. 假造立體表面 normal
  // ================================

  vec3 normal =
    normalize(
      vec3(
        -dx * 12.0,
        -dy * 12.0,
        1.0
      )
    );


  // 光從左上方來
  vec3 lightDirection =
    normalize(
      vec3(
        -0.7,
        -0.8,
        1.0
      )
    );


  vec3 viewDirection =
    vec3(
      0.0,
      0.0,
      1.0
    );


  vec3 halfDirection =
    normalize(
      lightDirection +
      viewDirection
    );


  // ================================
  // 5. 紫色果凍
  // ================================

  vec3 deepPurple =
    vec3(
      0.46,
      0.25,
      0.92
    );

  vec3 purple =
    vec3(
      0.68,
      0.48,
      1.0
    );

  vec3 lightPurple =
    vec3(
      0.83,
      0.72,
      1.0
    );


  float volume =
    smoothstep(
      0.15,
      0.95,
      soft
    );


  vec3 jellyColor =
    mix(
      deepPurple,
      purple,
      volume
    );


  jellyColor =
    mix(
      jellyColor,
      lightPurple,
      volume * 0.25
    );


  // ================================
  // 6. 柔和光
  // ================================

  float diffuse =
    max(
      dot(
        normal,
        lightDirection
      ),
      0.0
    );

  jellyColor +=
    diffuse *
    vec3(
      0.12,
      0.10,
      0.18
    );


  // ================================
  // 7. 鏡面高光
  // ================================

  float specular =
    pow(
      max(
        dot(
          normal,
          halfDirection
        ),
        0.0
      ),
      45.0
    );


  jellyColor +=
    specular *
    vec3(
      1.0,
      0.98,
      1.0
    ) *
    1.4;


  // ================================
  // 8. 寬一點的柔和高光
  // ================================

  float broadSpecular =
    pow(
      max(
        dot(
          normal,
          halfDirection
        ),
        0.0
      ),
      8.0
    );


  jellyColor +=
    broadSpecular *
    vec3(
      0.20,
      0.18,
      0.32
    );


  // ================================
  // 9. 邊緣深紫
  // ================================

  float edge =
    1.0 - volume;


  jellyColor =
    mix(
      jellyColor,
      deepPurple,
      edge * 0.45
    );


  // ================================
  // Output
  // ================================

  gl_FragColor =
    vec4(
      jellyColor,
      alpha
    );
}
`;
function preload(){
  font = loadFont("font/MomoTrustDisplay-Regular.ttf");
}

function setup() {
  let canvas = 
    createCanvas(1420, 750, WEBGL);
  canvas.style("border", "2px solid black");
  // ================================
  // 建立文字 mask
  // ================================
  mask = createGraphics(width, height);
  mask.pixelDensity(1);
  mask.clear();
  mask.textFont(font);
  mask.textSize(fontSize);
  mask.fill(255);
  mask.noStroke();

  let bounds = font.textBounds(word, 0, 0, fontSize);
  let x = width / 2 - (bounds.x + bounds.w / 2);
  let y = height / 2 - (bounds.y + bounds.h / 2);
  mask.text(word, x, y);
  // ================================
  // 建立模糊版本
  // shader 用它判斷「表面坡度」
  // ================================
  softMask = createGraphics(width, height);
  softMask.pixelDensity(1);
  softMask.clear();
  softMask.image(mask, 0, 0);
  softMask.filter(BLUR, 18);
  // ================================
  // 建立 shader
  // ================================
  jellyShader = createShader(vert, frag);
  noStroke();
}
function draw() {
  background(255);
  shader(jellyShader);
  jellyShader.setUniform(
    "uMask",
    mask
  );
  jellyShader.setUniform(
    "uSoftMask",
    softMask
  );
  jellyShader.setUniform(
    "uTexel",[1/width, 1/height]
  );
  jellyShader.setUniform(
    "uTime",
    millis() / 1000
  );
  rect(-width / 2, -height / 2, width, height);
}