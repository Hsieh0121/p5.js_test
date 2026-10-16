let font;
let mask;
let points = [];

let blobMask;
let softMask;

let jellyShader;

let word = "Dorobou";
let fontSize = 300;

let angle = 0;

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

void main() {

  vec2 uv = vTexCoord;


  // ================================
  // 2. 讀取字形
  // ================================

  float maskValue =
    texture2D(uMask, uv).a;

  float soft =
    texture2D(uSoftMask, uv).a;


  // 用模糊後的 softMask 重新決定外輪廓
  float alpha =
    smoothstep(
      0.20,
      0.45,
      soft
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
      0.52,
      0.39,
      0.92
    );

  vec3 purple =
    vec3(
      0.68,
      0.58,
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
      edge * 0.005
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
  // 把填滿的文字轉成 points
  // ================================

  mask.loadPixels();

  let gap = 8;

  for (let py = 0; py < height; py += gap) {

    for (let px = 0; px < width; px += gap) {

      let index =
        4 * (px + py * width);

      let alpha =
        mask.pixels[index + 3];

      if (alpha > 100) {

        points.push({
          x: px,
          y: py
        });

      }
    }
  }
  // ================================
  // 建立動態 blob mask
  // ================================

  blobMask =
    createGraphics(
      width,
      height
    );

  blobMask.pixelDensity(1);


  // ================================
  // 建立柔化版本
  // ================================

  softMask =
    createGraphics(
      width,
      height
    );

  softMask.pixelDensity(1);
  // ================================
  // 建立 shader
  // ================================
  jellyShader = createShader(vert, frag);
  angleMode(DEGREES);
  noStroke();
}
function draw() {
  background(255);
  // ================================
  // 1. 每一幀重新建立流動中的 blob
  // ================================

  blobMask.clear();

  blobMask.noStroke();
  blobMask.fill(255);


  for (let i = 0; i < points.length; i++) {

    let p = points[i];


    // 整塊物體左右流動
    let x =
      p.x +
      3 * sin(
        angle +
        p.y * 0.5
      );


    // 比較小的上下波動
    let y =
      p.y +
      3 * sin(
        angle * 0.7 +
        p.x * 0.35
      );


    // blob 自己也有一些膨脹
    let w =
      map(
        sin(
          angle +
          p.y * 0.05
        ),
        -1,
        1,
        28,
        46
      );


    let h =
      map(
        cos(
          angle +
          p.x * 0.04
        ),
        -1,
        1,
        26,
        44
      );


    blobMask.ellipse(
      x,
      y,
      w,
      h
    );
  }
  // ================================
  // 2. 把 blobMask 模糊
  // ================================

  softMask.clear();

  softMask.drawingContext.filter =
    "blur(22px)";

  softMask.image(
    blobMask,
    0,
    0
  );

  softMask.drawingContext.filter =
    "none";
  shader(jellyShader);
  jellyShader.setUniform(
    "uMask",
    blobMask
  );
  jellyShader.setUniform(
    "uSoftMask",
    softMask
  );
  jellyShader.setUniform(
    "uTexel",[1/width, 1/height]
  );
  rect(-width / 2, -height / 2, width, height);
  angle += 2;
}