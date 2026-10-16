/** 偵測→事件接口。輸入 radial 篩選後的候選與分析圖尺寸；輸出 clusters。
 * 以最高分候選作固定 anchor，其他成員必須同時通過圓心及半徑距離。
 * 固定 anchor 可避免 A接近B、B接近C 就一路連鎖吞掉不同半徑的圓。
 * 不以群大小刪除弱訊號：單一候選也留下。調大 tolerance 合併更多，過大會誤合併。
 */
function clusterCandidates(candidates, width, height) {
    const cfg = CONFIG.analysis.cluster;
    const groups = [];
    for (const c of [...candidates].sort((a,b)=>b.radialScore-a.radialScore)) {
        const g = groups.find(g => {
            const r = Math.min(c.radius, g.anchor.radius) * width;
            return Math.hypot((c.x-g.anchor.x)*width,(c.y-g.anchor.y)*height)
                <= Math.max(cfg.minCenterTolerancePx,r*cfg.centerToleranceRatio)
                && Math.abs(c.radius-g.anchor.radius)*width
                <= Math.max(cfg.minRadiusTolerancePx,r*cfg.radiusToleranceRatio);
        });
        if (g) g.members.push(c); else groups.push({anchor:c,members:[c]});
    }
    return groups.map(g => {
        const sum = g.members.reduce((s,c)=>s+Math.max(c.radialScore,0.001),0);
        const mean = key => g.members.reduce((s,c)=>s+c[key]*Math.max(c.radialScore,0.001),0)/sum;
        return {x:mean('x'),y:mean('y'),radius:mean('radius'),
            radialScore:mean('radialScore'), radialSupport:mean('radialSupport'),
            radialAlignment:mean('radialAlignment'), peakConfidence:g.anchor.radialScore,
            detectionMembers:g.members.length};
    });
}
/** clusters→RippleEvent[]。輸入無時間的幾何證據，輸出與 OpenCV 解耦的純資料。
 * radius/velocity 推估照片當下的 age，impactTime=-age；phase 是 age/週期。
 * 同心但半徑不同的結構仍各是一個假設，可能來自同一雨滴，並非確定的雨滴計數。
 * maxEvents 只是 GPU 工作上限，clusters/debug 仍全部保留；UI 會顯示截斷數量。
 */
function buildEvents(clusters) {
    return [...clusters].sort((a,b)=>b.radialScore-a.radialScore)
        .slice(0,CONFIG.temporal.maxEvents).map((c,i)=>({
            ...c,id:i+1,confidence:c.radialScore,
            strength:CONFIG.temporal.strength*c.radialScore,
            velocity:CONFIG.simulation.speed,decay:CONFIG.temporal.decay,
            impactTime:-c.radius/CONFIG.simulation.speed,
            phase:c.radius/CONFIG.temporal.wavelength
        }));
}
