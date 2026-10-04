let img;
let monji = "臓腫購難離観鑑饗嫌贈棚親聞積数踏邊康懇複委第晶美視過鬼者試彰信母荒宏急各昨利及呼早決先号ぱ台外冷可守は分化口ぜの公ロ江川ザざ土仁ろグエ下入りョふメ十二いょニぐシレュしイァヶこソントへヘっッくィノー一・";
let size;

function preload(){
    img = loadImage("/image/02.JPG");
}
// 把字體導入

function setup() {
  let canvasWidth = 1110;
  let canvasHeight = 740
  createCanvas(canvasWidth, canvasHeight);
  img.resize(100, 0);
  size = canvasWidth / img.width;
  print(size);
}

function draw() {
  background(255, 255, 255);
  for (let i=0; i<img.width; i++){
    for (let j=0; j<img.height; j++){
      let pixelVal = img.get(i,j);
      let c = brightness(pixelVal);
      let tIndex = floor(map(c, 0, 100, 0, monji.length));

      let x = i*size;
      let y = j*size;
      let t = monji.charAt(tIndex);
      textSize(size);
      text(t, x, y);
    }
  }

}

