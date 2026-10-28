/**
 * Draft overlay geometry — engine-free screen projection of a placement draft's world box.
 *
 * PlayCanvas projects; the UI draws. The result gives the UI anchor points for its own icons
 * (move icon, Apply / Cancel) and the screen outline of the box:
 * - hull:   convex hull of the 8 projected corners (what the box covers on screen)
 * - bounds: screen rectangle of the hull
 * - points: center (box centre), frontCenter (centre of the vertical face turned to the camera),
 *           topLeft/topRight/bottomLeft/bottomRight/topCenter/bottomCenter of `bounds`
 * Coordinates are CSS pixels of the configurator's viewport (canvas offset already added).
 */ const DRAFT_OVERLAY_POINTS = Object.freeze([
    'center',
    'frontCenter',
    'topLeft',
    'topRight',
    'bottomLeft',
    'bottomRight',
    'topCenter',
    'bottomCenter'
]);
const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const round = (value)=>Math.round(value * 100) / 100;
const HIDDEN = Object.freeze({
    visible: false,
    hull: Object.freeze([]),
    bounds: null,
    points: null
});
function boxCorners({ minM, maxM }) {
    const corners = [];
    for (const x of [
        minM.x,
        maxM.x
    ])for (const y of [
        minM.y,
        maxM.y
    ])for (const z of [
        minM.z,
        maxM.z
    ]){
        corners.push({
            x,
            y,
            z
        });
    }
    return corners;
}
/** Monotone chain (collinear points dropped); starts at the left-most, top-most point. */ function convexHull(points) {
    const unique = [
        ...new Map(points.map((p)=>[
                `${p.x}|${p.y}`,
                p
            ])).values()
    ].sort((a, b)=>a.x - b.x || a.y - b.y);
    if (unique.length < 3) return unique;
    const cross = (o, a, b)=>(a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (list)=>{
        const out = [];
        for (const p of list){
            while(out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0)out.pop();
            out.push(p);
        }
        out.pop();
        return out;
    };
    return [
        ...half(unique),
        ...half([
            ...unique
        ].reverse())
    ];
}
/**
 * @param {object} input
 * @param {{minM:{x,y,z}, maxM:{x,y,z}}} input.box   world box of the draft (metres)
 * @param {(pointM:{x,y,z}) => ({x:number,y:number,z:number}|null)} input.project
 *        world -> screen CSS px of the canvas; `z` is the clip-space w (<= 0: behind the camera)
 * @param {{x,y,z}} [input.cameraPositionM]        picks the front (camera-facing) Z face
 * @param {{x:number,y:number}} [input.offset]     canvas offset inside the viewport
 */ /** world point (m) -> viewport CSS px `{ x, y }`, or null behind the camera / not projectable. */ function createScreenProjector({ project, offset = {
    x: 0,
    y: 0
} } = {}) {
    const dx = finite(offset?.x) ? offset.x : 0, dy = finite(offset?.y) ? offset.y : 0;
    return (pointM)=>{
        const p = project(pointM);
        if (!p || !finite(p.x) || !finite(p.y) || !finite(p.z) || p.z <= 0) return null;
        return {
            x: round(p.x + dx),
            y: round(p.y + dy)
        };
    };
}
/** Z of the box face turned to the camera (+Z face unless the camera is on the -Z side). */ function frontFaceZ(box, cameraPositionM = null) {
    const cz = (box.minM.z + box.maxM.z) / 2;
    return finite(cameraPositionM?.z) && cameraPositionM.z < cz ? box.minM.z : box.maxM.z;
}
function projectDraftOverlay({ box, project, cameraPositionM = null, offset = {
    x: 0,
    y: 0
} } = {}) {
    if (!box?.minM || !box?.maxM || typeof project !== 'function') return HIDDEN;
    const toScreen = createScreenProjector({
        project,
        offset
    });
    const corners = boxCorners(box).map(toScreen);
    if (corners.some((point)=>!point)) return HIDDEN;
    const hull = convexHull(corners);
    const xs = hull.map((p)=>p.x), ys = hull.map((p)=>p.y);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const c = {
        x: (box.minM.x + box.maxM.x) / 2,
        y: (box.minM.y + box.maxM.y) / 2,
        z: (box.minM.z + box.maxM.z) / 2
    };
    const frontZ = frontFaceZ(box, cameraPositionM);
    const center = toScreen(c), frontCenter = toScreen({
        ...c,
        z: frontZ
    });
    if (!center || !frontCenter) return HIDDEN;
    const midX = round((left + right) / 2);
    return Object.freeze({
        visible: true,
        hull: Object.freeze(hull.map((p)=>Object.freeze(p))),
        bounds: Object.freeze({
            left,
            top,
            right,
            bottom,
            width: round(right - left),
            height: round(bottom - top)
        }),
        points: Object.freeze({
            center,
            frontCenter,
            topLeft: {
                x: left,
                y: top
            },
            topRight: {
                x: right,
                y: top
            },
            bottomLeft: {
                x: left,
                y: bottom
            },
            bottomRight: {
                x: right,
                y: bottom
            },
            topCenter: {
                x: midX,
                y: top
            },
            bottomCenter: {
                x: midX,
                y: bottom
            }
        })
    });
}

export { DRAFT_OVERLAY_POINTS, boxCorners, convexHull, createScreenProjector, frontFaceZ, projectDraftOverlay };
