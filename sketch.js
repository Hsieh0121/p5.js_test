let font;
let points = [];
// 建立一個 array = [];
let r = 2; let angle = 0;
let purple;
let lightPurple;


function preload(){
    font = loadFont("font/MomoTrustDisplay-Regular.ttf")
}
// 把字體導入

function setup() {
  let canvas = createCanvas(1420, 750);
  canvas.style('border', '2px solid black');
//   points = font.textToPoints("Dorobou", 0, 300,300);
//   // points 這個陣列 = 把字體變成點狀 （前面定義過font是什麼字體了）
  let word = "Dorobou";
  let fontSize = 300;
  let bounds = font.textBounds(word, 0, 0, fontSize);
  let x = width / 2 - (bounds.x + bounds.w / 2);
  let y = height / 2 - (bounds.y + bounds.h / 2);
  //把x,y值拆開來define，彈性更大。如果想要變化array中的個別數值都可以用這樣的方法

  let mask = createGraphics(width, height);
  mask.pixelDensity(1);
  mask.clear();
  mask.textFont(font);
  mask.textSize(fontSize);
  mask.noStroke();
  mask.text(word, x, y);
  mask.loadPixels();
  let gap = 8;
  for (let py = 0; py < height; py += gap){
    for (let px = 0; px < width; px += gap){
        let index = 4 * (px + py * width);
        let alpha = mask.pixels[index + 3];
        if (alpha > 100) {
            points.push({
                x: px,
                y: py
            });
        }
    }
  }
  purple = color(215, 175, 255);
  lightPurple = color(238, 218, 255);
  angleMode(DEGREES)
}

function draw() {
  background(255, 255, 255);
  noStroke();
  for (let i = 0; i < points.length; i++){
    let x = points[i].x  + r*sin(angle + i*12);
    let y = points[i].y;
    let w = map(sin(angle + i * 12), -1, 1, 40, 50);
    let h = map(cos(angle + i * 12),-1, 1, 20, 50);
    let a = map(sin(angle + i * 12), -1, 1, 220, 255); 
    //map(數值, 原本最小值, 原本最大值, 新最小值, 新最大值),可以把把一個範圍轉換成另一個範圍
    let tone = map(sin(angle), -1, 1, 0, 0.08);
    let jellyColor = lerpColor(purple, lightPurple, tone);
    jellyColor.setAlpha(a);
    fill(jellyColor);
    ellipse(x, y, w, h);
    // 高光
    // blendMode(SCREEN);
    // let highlightColor = lerpColor(
    //     jellyColor, color(255), 0.9
    // );
    // highlightColor.setAlpha(255);
    // fill(highlightColor);
    // ellipse(x - w * 0.12, y - h * 0.15, w * 0.45, h * 0.18);
    // blendMode(BLEND);
  }
  angle += 2;
}

