// Pure (engine-free) per-side resize bounds + coverage check for countertops.
const COUNTERTOP_BASIN_EDGE_MARGIN_M = 0.1; // client rule: integrated basin edge >= 10 cm from the CT end; vessel: 0
const COUNTERTOP_COVERAGE_REASON = Object.freeze({
    BASIN_EDGE: 'BASIN_EDGE_TOO_CLOSE',
    SB_NOT_COVERED: 'SINK_BASE_NOT_COVERED'
});
const validBox = (b)=>!!b && Number.isFinite(b.minX) && Number.isFinite(b.maxX);
// Per-cut-out margin (c.marginM, finite >= 0) wins over the function-level one; vessel: 0.
const cutoutMarginM = (c, marginM)=>c.vessel ? 0 : Number.isFinite(c.marginM) && c.marginM >= 0 ? c.marginM : marginM;
/**
 * Required basin-edge margin of an integrated cut-out (owner decision, temporary): min(maxM, (host - cutout) / 2),
 * so the standard pose on its host cabinet is valid by definition. hostWidthM not finite -> maxM.
 */ function basinEdgeMarginM({ cutoutWidthM, hostWidthM, maxM = COUNTERTOP_BASIN_EDGE_MARGIN_M }) {
    if (!Number.isFinite(hostWidthM) || !Number.isFinite(cutoutWidthM)) return maxM;
    return Math.min(maxM, Math.max(0, (hostWidthM - cutoutWidthM) / 2));
}
/**
 * Length bounds for a one-end resize: the opposite end (anchor) stays.
 * side: 'left' (-X end moves) | 'right' (+X end moves)
 * -> { anchorXM, minLengthM, maxLengthM, basinMinLengthM, supportMinLengthM }
 */ function resolveResizeBoundsM({ side, ctBox, cutouts = [], supportBoxes = [], materialMinM, materialMaxM, marginM = COUNTERTOP_BASIN_EDGE_MARGIN_M }) {
    if (side !== 'left' && side !== 'right') throw new TypeError(`resolveResizeBoundsM: invalid side "${side}"`);
    if (!validBox(ctBox)) throw new TypeError('resolveResizeBoundsM: ctBox must have finite minX/maxX');
    const anchorXM = side === 'right' ? ctBox.minX : ctBox.maxX;
    const far = (b)=>side === 'right' ? b.maxX : b.minX;
    let basinMinLengthM = 0;
    for (const c of cutouts){
        if (!validBox(c)) continue;
        basinMinLengthM = Math.max(basinMinLengthM, Math.abs(far(c) - anchorXM) + cutoutMarginM(c, marginM));
    }
    let supportMinLengthM = 0;
    for (const b of supportBoxes){
        if (!validBox(b)) continue;
        supportMinLengthM = Math.max(supportMinLengthM, Math.abs(far(b) - anchorXM));
    }
    const minLengthM = Math.max(materialMinM, basinMinLengthM, supportMinLengthM);
    const maxLengthM = Math.max(materialMaxM, minLengthM);
    return {
        anchorXM,
        minLengthM,
        maxLengthM,
        basinMinLengthM,
        supportMinLengthM
    };
}
/**
 * Coverage of a CT pose (used for a moved, not-attached CT): every basin cut-out stays >= margin inside the CT
 * ends (vessel: inside), and every support box (sink base the CT rests on) is fully covered.
 * -> [{ code, id }]  (empty = valid)
 */ function countertopCoverageViolations({ ctBox, cutouts = [], supportBoxes = [], marginM = COUNTERTOP_BASIN_EDGE_MARGIN_M, tolM = 1e-4 }) {
    const out = [];
    for (const c of cutouts){
        if (!validBox(c)) continue;
        const m = cutoutMarginM(c, marginM);
        if (c.minX < ctBox.minX + m - tolM || c.maxX > ctBox.maxX - m + tolM) {
            out.push({
                code: COUNTERTOP_COVERAGE_REASON.BASIN_EDGE,
                id: c.id ?? null
            });
        }
    }
    for (const b of supportBoxes){
        if (!validBox(b)) continue;
        if (b.minX < ctBox.minX - tolM || b.maxX > ctBox.maxX + tolM) {
            out.push({
                code: COUNTERTOP_COVERAGE_REASON.SB_NOT_COVERED,
                id: b.id ?? null
            });
        }
    }
    return out;
}

export { COUNTERTOP_BASIN_EDGE_MARGIN_M, COUNTERTOP_COVERAGE_REASON, basinEdgeMarginM, countertopCoverageViolations, resolveResizeBoundsM };
