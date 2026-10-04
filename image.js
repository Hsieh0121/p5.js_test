let img;

let monji =
  "臓鰭種獲灘腹鰓雌捕類胸繁顎雄餌棘眼殖着群頭個歯軟尾漂板遊底温回港域熟海島食漁成魚吻湾深浅骨皮幼岸背息肉肝体布泳洋生沖沿水分口ロガギザモタホカオサヌキエチヤウラスマワクブアメジナミドベツハュリレシイント";

let size;


let sharkThreshold = 42;
let sharkSpeed = 4;
let bgCharMax = 30;
let sharkOffsetX = 0;


let sharkCells = [];
let bgLayer;

let sharkMinX = Infinity;
let sharkMaxX = -Infinity;


function preload() {
  img = loadImage("/image/02.JPG");
}


function setup() {
  rectMode(CENTER);

  let canvasWidth = 1110;
  let canvasHeight = 740;

  createCanvas(canvasWidth, canvasHeight);

  img.resize(148, 0);

  size = canvasWidth / img.width;

  frameRate(24);

  img.loadPixels();


  bgLayer = createGraphics(
    canvasWidth,
    canvasHeight
  );

  bgLayer.background(255);

  bgLayer.textSize(size);
  bgLayer.textAlign(CENTER, CENTER);
  bgLayer.noStroke();

  for (let i = 0; i < img.width; i++) {

    for (let j = 0; j < img.height; j++) {

      let index =
        4 * (i + j * img.width);

      let r = img.pixels[index];
      let g = img.pixels[index + 1];
      let b = img.pixels[index + 2];

      let c = (r + g + b) / 3;

      let x = i * size;
      let y = j * size;

      let isShark = c > sharkThreshold;

      if (isShark) {
        sharkCells.push({
          x: x,
          y: y,
          r: r,
          g: g,
          b: b,
          brightness: c
        });

        sharkMinX = min(sharkMinX, x);

        sharkMaxX = max(sharkMaxX, x);
      }

      let bgIndex = floor(random(bgCharMax));
      let bgChar = monji.charAt(bgIndex);

      bgLayer.fill(15, 30, 55);

      bgLayer.text(bgChar, x, y);
    }
  }
}


function draw() {
  rectMode(CENTER);
  background(255);

  image(bgLayer, 0, 0);


  textSize(size);
  textAlign(CENTER, CENTER);
  noStroke();

  fill(255);
  noStroke();
  for (let cell of sharkCells) {
    rect(
      cell.x + sharkOffsetX,
      cell.y,
      size,
      size
    );
  }


  for (let cell of sharkCells) {

    let tIndex = floor(
      map(
        cell.brightness,
        0,
        255,
        monji.length - 1,
        0,
      )
    );

    let t =
      monji.charAt(tIndex);

    fill(
      cell.r,
      cell.g,
      cell.b
    );

    text(
      t,
      cell.x + sharkOffsetX,
      cell.y
    );
  }

  sharkOffsetX -= sharkSpeed;

  if (
    sharkMaxX + sharkOffsetX < 0
  ) {

    sharkOffsetX =
      width - sharkMinX;
  }
}