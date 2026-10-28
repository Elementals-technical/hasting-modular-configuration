/**
 * Draft collision — engine-free AABB overlap of a placement draft against committed obstacles.
 *
 * Product rule (2026-09-29): any overlap of the dragged cabinet with another cabinet is a
 * collision; the draft is shown red and Apply is blocked. Touching faces are not an overlap:
 * snapped neighbours share a face exactly and rows keep a 0.5 mm gap, so the overlap must exceed
 * `toleranceM` on every axis. Boxes are `{ minM:{x,y,z}, maxM:{x,y,z} }` in world metres.
 */ const DRAFT_COLLISION_TOLERANCE_M = 1e-4;
const DRAFT_COLLISION_REASON = 'CABINET_COLLISION';
/** Product decision (a) 2026-09-30: the floor collides with the cabinet BODY only (from its pivot Y
 * up); a sink hanging below the body may go below the floor. Cabinet-vs-cabinet stays on meshes. */ const FLOOR_BODY_ID = 'Floor_R1';
const isBodyOnly = (neighbour)=>neighbour.bodyOnly === true || neighbour.id === FLOOR_BODY_ID;
const AXES = Object.freeze([
    'x',
    'y',
    'z'
]);
const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const point = (value)=>!!value && AXES.every((axis)=>finite(value[axis]));
const isBox = (box)=>!!box && point(box.minM) && point(box.maxM) && AXES.every((axis)=>box.maxM[axis] >= box.minM[axis]);
/** Box expressed relative to a pivot (the draft root position), so it can follow the pivot. */ function relativeBox(box, pivotM) {
    if (!isBox(box) || !point(pivotM)) throw new TypeError('A measured box and a finite pivot are required');
    const shift = (value)=>Object.fromEntries(AXES.map((axis)=>[
                axis,
                value[axis] - pivotM[axis]
            ]));
    return Object.freeze({
        minM: Object.freeze(shift(box.minM)),
        maxM: Object.freeze(shift(box.maxM))
    });
}
/** A relative box placed at a pivot. */ function boxAt(relative, pivotM) {
    if (!isBox(relative) || !point(pivotM)) throw new TypeError('A relative box and a finite pivot are required');
    const shift = (value)=>Object.fromEntries(AXES.map((axis)=>[
                axis,
                value[axis] + pivotM[axis]
            ]));
    return Object.freeze({
        minM: Object.freeze(shift(relative.minM)),
        maxM: Object.freeze(shift(relative.maxM))
    });
}
/** True when the boxes overlap by more than the tolerance on every axis. */ function boxesOverlap(a, b, toleranceM = DRAFT_COLLISION_TOLERANCE_M) {
    if (!isBox(a) || !isBox(b)) return false;
    return AXES.every((axis)=>Math.min(a.maxM[axis], b.maxM[axis]) - Math.max(a.minM[axis], b.minM[axis]) > toleranceM);
}
/**
 * @param {object} input
 * @param {{minM, maxM}|null} input.box              the draft's world box (null = not measurable)
 * @param {{id:string, box:{minM,maxM}|null, bodyOnly?:boolean}[]} input.neighbours  committed cabinets (source of a move excluded) and the primary slab;
 *   the floor (id FLOOR_BODY_ID or bodyOnly) is tested against the body only
 * @param {number|null} [input.levelM]  the draft's pivot Y (body bottom); absent = mesh box everywhere
 * @returns {{ status:'clear'|'colliding'|'unknown', collidesWith:string[] }}
 *   `unknown` when the draft or a neighbour could not be measured and nothing overlaps.
 */ function detectDraftCollision({ box, neighbours = [], toleranceM = DRAFT_COLLISION_TOLERANCE_M, levelM = null } = {}) {
    if (!isBox(box)) return Object.freeze({
        status: 'unknown',
        collidesWith: Object.freeze([])
    });
    // levelM = the draft's pivot Y (body bottom): body-only neighbours (the floor) see the box raised to it.
    const bodyBox = finite(levelM) ? Object.freeze({
        minM: Object.freeze({
            ...box.minM,
            y: levelM
        }),
        maxM: Object.freeze({
            ...box.maxM,
            y: Math.max(box.maxM.y, levelM)
        })
    }) : box;
    let incomplete = false;
    const hits = new Set();
    for (const neighbour of neighbours){
        if (!neighbour || typeof neighbour.id !== 'string') continue;
        if (!isBox(neighbour.box)) {
            incomplete = true;
            continue;
        }
        if (boxesOverlap(isBodyOnly(neighbour) ? bodyBox : box, neighbour.box, toleranceM)) hits.add(neighbour.id);
    }
    const collidesWith = Object.freeze([
        ...hits
    ].sort());
    const status = collidesWith.length ? 'colliding' : incomplete ? 'unknown' : 'clear';
    return Object.freeze({
        status,
        collidesWith
    });
}

export { DRAFT_COLLISION_REASON, DRAFT_COLLISION_TOLERANCE_M, FLOOR_BODY_ID, boxAt, boxesOverlap, detectDraftCollision, relativeBox };
