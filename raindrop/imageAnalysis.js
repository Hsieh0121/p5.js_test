/** 圖片分析層：接收 analysisImg，輸出 debug 圖與 houghCandidates。
 * 原照片只讀；分析前先複製縮圖。所有圓位置都除以對應尺寸，半徑除以寬。
 * OpenCV Mat 是手動管理的記憶體；即使中途出錯，也必須在 finally 釋放。
 * scale/blur/hough/radial 改變偵測；Canny 只影響診斷圖，沒有參與 Hough。
 */
function processAnalysisImage() {
    console.log("starting OpenCV analysis");
    
    analysisImg.loadPixels();

    let imageData = new ImageData(
        new Uint8ClampedArray(analysisImg.pixels),
        analysisImg.width,
        analysisImg.height
    );

    const mats = [];
    const own = mat => (mats.push(mat), mat);
    try {
    let src = own(cv.matFromImageData(imageData));
    let gray = own(new cv.Mat());
    let blurred = own(new cv.Mat());

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    let kernelSize = CONFIG.analysis.blurKernel;
    let kernel = new cv.Size(kernelSize, kernelSize);
    cv.GaussianBlur(gray, blurred, kernel, 0, 0, cv.BORDER_DEFAULT);

    let circles = own(new cv.Mat());

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

    let gradX = own(new cv.Mat());
    let gradY = own(new cv.Mat());

    let absGradX = own(new cv.Mat());
    let absGradY = own(new cv.Mat());

    let gradient = own(new cv.Mat());
    let edges = own(new cv.Mat());

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

    let grayRGBA = own(new cv.Mat());
    let blurRGBA = own(new cv.Mat());
    let gradientRGBA = own(new cv.Mat());
    let edgeRGBA = own(new cv.Mat());

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

    } finally {
        for (const mat of mats) mat.delete();
    }

}

/** 徑向評分：輸入 candidate 與有正負方向的 Sobel X/Y Mat；輸出 score/support/alignment。
 * 沿圓周取樣，在 r±radiusSearch 找最強梯度，再比較它是否指向圓心或背離圓心。
 * 絕對內積讓亮→暗及暗→亮都能成立。支援越少，最後 score 越受抑制。
 * 這是幾何證據分數，並非校準過的真實機率；參數放在 analysis.radial。
 */
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