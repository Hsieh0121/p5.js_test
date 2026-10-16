let img;
let monji = "臓鰭種獲灘腹鰓雌捕類胸繁顎雄餌棘眼殖着群頭個歯軟尾漂板遊底温回港域熟海島食漁成魚吻湾深浅骨皮幼岸背息肉肝体布泳洋生沖沿水分口ロガギザモタホカオサヌキエチヤウラスマワクブアメジナミドベツハュリレシイント";
let size;
function preload(){
    img = loadImage("/image/02.JPG");
}
// 把字體導入
function setup() {
  let canvasWidth = 1110;
  let canvasHeight = 740
createCanvas(canvasWidth, canvasHeight);
  img.resize(148, 0);
  size = canvasWidth / img.width;
print(size);
noLoop();
}
function draw() {
background(255);
  img.loadPixels();
textSize(size);
textAlign(CENTER, CENTER);
  for (let i = 0; i < img.width; i++) {
    for (let j = 0; j < img.height; j++) {
      let index = 4 * (i + j * img.width);
      let r = img.pixels[index];
      let g = img.pixels[index + 1];
      let b = img.pixels[index + 2];
      let c = (r + g + b) / 3;
      let tIndex = floor(
map(c, 0, 255, 0, monji.length - 1)
      );
      let x = i * size;
      let y = j * size;
      let t = monji.charAt(tIndex);
fill(r, g, b);
text(t, x, y);
    }
  }
}