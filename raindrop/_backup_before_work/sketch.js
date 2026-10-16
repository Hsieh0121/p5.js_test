const CONFIG = {
    canvas: {
        width: 1080,
        height: 1920,
        pixelDensity: 1
    },
    source: {path: "assets/raindrop.JPG"},
    analysis: {
        scale: 0.2,
        blurKernel: 7,
        sobelKernel: 3,

        cannyLow: 16,
        cannyHigh: 48,

        hough: {
            dp: 1.2,
            minDist: 20,
            param1: 48,
            param2: 12,
            minRadius: 8,
            maxRadius: 80
        },

        radial: {
            samples: 72,
            radiusSearch: 3,
            minGradient: 8,
            alignmentThreshold: 0.65,
            keepThreshold: 0.50
        }
    }
};

let img;
let analysisImg;

let grayImg;
let blurImg;
let gradientImg;
let edgeImg;

let houghCandidates = [];

let openCVProcessed = false;

let viewMode = "source";

function preload() {
    img = loadImage(CONFIG.source.path);
}

function setup() {
    pixelDensity(CONFIG.canvas.pixelDensity);
    createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);

    console.log("original image size");
    console.log(img.width, img.height);

    buildAnalysisImage();
}

function draw() {
    background(220);

    if (
        window.cvReady && 
        analysisImg &&
        !openCVProcessed
    ) {
        processAnalysisImage();
        openCVProcessed = true;
    }

    if (viewMode === "source"){
        image(img, 0, 0, width, height);
    }
    if (viewMode === "analysis"){
        image(analysisImg, 0, 0, width, height);
    }

    if (
        viewMode === "gray" && grayImg
    ) {
        image(grayImg, 0, 0, width, height);
    }
    if (
        viewMode === "blur" && blurImg
    ) {
        image(blurImg, 0, 0, width, height);
    }
    if (
        viewMode === "gradient" && gradientImg
    ) {
        image(gradientImg, 0, 0, width, height);
    }
    if (
        viewMode === "edge" && edgeImg
    ) {
        image(edgeImg, 0, 0, width, height);
    }
    if (viewMode === "hough") {
        image(img, 0, 0, width, height);
        drawHoughCandidates();
    }
    if (viewMode === "radial") {
        image(img, 0, 0, width, height);
        drawRadialCandidates();
    }
}

function buildAnalysisImage(){
    analysisImg = img.get();

    let analysisWidth = floor(img.width * CONFIG.analysis.scale);
    let analysisHeight = floor(img.height * CONFIG.analysis.scale);
    analysisImg.resize(analysisWidth, analysisHeight);

    console.log("analysis image size");
    console.log(analysisImg.width, analysisImg.height);
}

function keyPressed() {

  if (key === "s" || key === "S") {
    viewMode = "source";
    console.log("view: source");
  }


  if (key === "a" || key === "A") {
    viewMode = "analysis";
    console.log("view: analysis");
  }


  if (key === "g" || key === "G") {
    viewMode = "gray";
    console.log("view: grayscale");
  }


  if (key === "b" || key === "B") {
    viewMode = "blur";
    console.log("view: blurred");
  }

  if (key === "m" || key === "M") {
    viewMode = "gradient";
    console.log("view: gradient magnitude");
  }
  if (key === "e" || key === "E") {
    viewMode = "edge";
    console.log("view: Canny edge");
  }
  if (key === "h" || key === "H") {
    viewMode = "hough";
    console.log(
        "view: Hough candidates"
    );
  }
  if (key === "r" || key === "R") {
    viewMode = "radial";

    console.log(
        "view: radial candidates"
    );
  }
}

function processAnalysisImage() {
    console.log("starting OpenCV analysis");
    
    analysisImg.loadPixels();

    let imageData = new ImageData(
        new Uint8ClampedArray(analysisImg.pixels),
        analysisImg.width,
        analysisImg.height
    );

    let src = cv.matFromImageData(imageData);
    let gray = new cv.Mat();
    let blurred = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    let kernelSize = CONFIG.analysis.blurKernel;
    let kernel = new cv.Size(kernelSize, kernelSize);
    cv.GaussianBlur(gray, blurred, kernel, 0, 0, cv.BORDER_DEFAULT);

    let circles = new cv.Mat();

    let houghConfig =
        CONFIG.analysis.hough;

    cv.HoughCircles(
        blurred,
        circles,

        cv.HOUGH_GRADIENT,

        houghConfig.dp,
        houghConfig.minDist,

        houghConfig.param1,
        houghConfig.param2,

        houghConfig.minRadius,
        houghConfig.maxRadius
    );

    houghCandidates = [];

    let circleCount =
        circles.data32F.length / 3;

    for (let i = 0; i < circleCount; i++) {

        let x =
            circles.data32F[i * 3];

        let y =
            circles.data32F[i * 3 + 1];

        let radius =
            circles.data32F[i * 3 + 2];


        houghCandidates.push({
            x: x / analysisImg.width,
            y: y / analysisImg.height,
            radius: radius / analysisImg.width,

            radialScore: 0,
            radialAlignment: 0,
            radialSupport: 0
        });
    }

    console.log(
        "Hough circle candidates:",
        houghCandidates.length
    );

    console.log(
        houghCandidates
    );

    let gradX = new cv.Mat();
    let gradY = new cv.Mat();

    let absGradX = new cv.Mat();
    let absGradY = new cv.Mat();

    let gradient = new cv.Mat();
    let edges = new cv.Mat();

    cv.Sobel(blurred, gradX, cv.CV_16S, 1, 0, CONFIG.analysis.sobelKernel);
    cv.Sobel(blurred, gradY, cv.CV_16S, 0, 1, CONFIG.analysis.sobelKernel);

    for (
        let candidate of houghCandidates
    ) {

        let result =
            scoreRadialCandidate(
                candidate,
                gradX,
                gradY
            );


        candidate.radialScore =
            result.score;

        candidate.radialSupport =
            result.support;

        candidate.radialAlignment =
            result.alignment;
    }
        console.log(
        "radial scored candidates:",
        houghCandidates
    );
    let radialScores =
    houghCandidates
        .map(candidate => candidate.radialScore)
        .sort((a, b) => a - b);

    console.log("radial score min:", radialScores[0]);

    console.log(
        "radial score median:",
        radialScores[
            floor(radialScores.length / 2)
        ]
    );

    console.log(
        "radial score max:",
        radialScores[
            radialScores.length - 1
        ]
    );

    cv.convertScaleAbs(gradX, absGradX);
    cv.convertScaleAbs(gradY, absGradY);

    cv.addWeighted(absGradX, 0.5, absGradY, 0.5, 0, gradient);

    cv.Canny(blurred, edges, CONFIG.analysis.cannyLow, CONFIG.analysis.cannyHigh, 3, false);

    let grayRGBA = new cv.Mat();
    let blurRGBA = new cv.Mat();
    let gradientRGBA = new cv.Mat();
    let edgeRGBA = new cv.Mat();

    cv.cvtColor(
        gray,
        grayRGBA,
        cv.COLOR_GRAY2RGBA
    );

    cv.cvtColor(
        blurred,
        blurRGBA,
        cv.COLOR_GRAY2RGBA
    );

    cv.cvtColor(
        gradient,
        gradientRGBA,
        cv.COLOR_GRAY2RGBA
    );

    cv.cvtColor(
        edges,
        edgeRGBA,
        cv.COLOR_GRAY2RGBA
    );

    grayImg = createImage(
        analysisImg.width,
        analysisImg.height
    );

    blurImg = createImage(
        analysisImg.width,
        analysisImg.height
    );

    gradientImg = createImage(
        analysisImg.width,
        analysisImg.height
    );
    edgeImg = createImage(
        analysisImg.width,
        analysisImg.height
    );

    grayImg.loadPixels();
    grayImg.pixels.set(grayRGBA.data);
    grayImg.updatePixels();

    blurImg.loadPixels();
    blurImg.pixels.set(blurRGBA.data);
    blurImg.updatePixels();

    gradientImg.loadPixels();
    gradientImg.pixels.set(gradientRGBA.data);
    gradientImg.updatePixels();

    edgeImg.loadPixels();
    edgeImg.pixels.set(edgeRGBA.data);
    edgeImg.updatePixels();

    console.log("OpenCV analysis finished");

    src.delete();
    gray.delete();
    blurred.delete();

    gradX.delete();
    gradY.delete();

    absGradX.delete();
    absGradY.delete();

    gradient.delete();
    edges.delete();
    circles.delete();

    grayRGBA.delete();
    blurRGBA.delete();  
    gradientRGBA.delete();
    edgeRGBA.delete();
}
function drawHoughCandidates() {

    noFill();

    stroke(0, 255, 255);
    strokeWeight(2);


    for (let candidate of houghCandidates) {

        let x =
            candidate.x * width;

        let y =
            candidate.y * height;

        let radius =
            candidate.radius * width;


        circle(
            x,
            y,
            radius * 2
        );


        // 圓心
        line(
            x - 5,
            y,
            x + 5,
            y
        );

        line(
            x,
            y - 5,
            x,
            y + 5
        );
    }
}
function drawRadialCandidates() {

    noFill();


    for (
        let candidate of houghCandidates
    ) {

        if (
            candidate.radialScore <
            CONFIG.analysis.radial.keepThreshold
        ) {
            continue;
        }


        let x =
            candidate.x * width;

        let y =
            candidate.y * height;

        let radius =
            candidate.radius * width;


        // score 越高
        // 線越粗

        let weight =
            map(
                candidate.radialScore,
                CONFIG.analysis.radial.keepThreshold,
                1,
                1,
                5,
                true
            );


        stroke(
            0,
            255,
            255
        );

        strokeWeight(weight);


        circle(
            x,
            y,
            radius * 2
        );


        // 圓心
        point(
            x,
            y
        );
    }
}
function scoreRadialCandidate(
    candidate,
    gradX,
    gradY
) {

    const radialConfig =
        CONFIG.analysis.radial;

    const sampleCount =
        radialConfig.samples;

    const radiusSearch =
        radialConfig.radiusSearch;

    const minGradient =
        radialConfig.minGradient;

    const alignmentThreshold =
        radialConfig.alignmentThreshold;


    // normalized coordinate → analysis pixel coordinate

    const centerX =
        candidate.x * analysisImg.width;

    const centerY =
        candidate.y * analysisImg.height;

    const baseRadius =
        candidate.radius * analysisImg.width;


    let supportedSamples = 0;

    let alignmentSum = 0;


    for (
        let i = 0;
        i < sampleCount;
        i++
    ) {

        const angle =
            TWO_PI * i / sampleCount;

        const radialX =
            cos(angle);

        const radialY =
            sin(angle);


        let bestMagnitude = 0;
        let bestAlignment = 0;


        // 在 r ± radiusSearch 範圍內
        // 找 gradient 最強的位置

        for (
            let offset = -radiusSearch;
            offset <= radiusSearch;
            offset++
        ) {

            const radius =
                baseRadius + offset;

            const px =
                round(
                    centerX +
                    radialX * radius
                );

            const py =
                round(
                    centerY +
                    radialY * radius
                );


            // 超出圖片就跳過

            if (
                px < 0 ||
                px >= analysisImg.width ||
                py < 0 ||
                py >= analysisImg.height
            ) {
                continue;
            }


            const index =
                py * analysisImg.width + px;


            const gx =
                gradX.data16S[index];

            const gy =
                gradY.data16S[index];


            const magnitude =
                sqrt(
                    gx * gx +
                    gy * gy
                );


            if (
                magnitude < minGradient
            ) {
                continue;
            }


            // gradient direction
            const gradientX =
                gx / magnitude;

            const gradientY =
                gy / magnitude;


            // gradient 和 radial vector 的夾角關係

            const alignment =
                abs(
                    gradientX * radialX +
                    gradientY * radialY
                );


            if (
                magnitude > bestMagnitude
            ) {
                bestMagnitude =
                    magnitude;

                bestAlignment =
                    alignment;
            }
        }


        if (
            bestMagnitude >= minGradient
        ) {

            supportedSamples++;


            if (
                bestAlignment >=
                alignmentThreshold
            ) {
                alignmentSum +=
                    bestAlignment;
            }
        }
    }


    const support =
        supportedSamples /
        sampleCount;


    const averageAlignment =
        supportedSamples > 0
            ? alignmentSum /
              supportedSamples
            : 0;


    const score =
        averageAlignment *
        sqrt(support);


    return {
        score,
        support,
        alignment:
            averageAlignment
    };
}