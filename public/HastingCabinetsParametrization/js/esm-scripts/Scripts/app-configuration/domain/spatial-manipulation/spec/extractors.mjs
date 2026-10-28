/**
 * Snap feature extractors (engine-free).
 *
 * An extractor receives one measured body — `{ id, tags, meta, boundsUV }` where `boundsUV` is
 * `{ min: { u, v, w }, max: { u, v, w } }` in the manipulable's frame — and returns feature
 * descriptors:
 *
 *   { key, geometry: { kind: 'axis', axis: 'u'|'v', valueM } | { kind: 'point', pointM: { u, v } },
 *     supportIntervalUM?, featureId?, role?, partId?, ownerObjectId? }
 *
 * The compiler names features `${group}:${body.id}:${key}` with role `${group}.${key}` unless the
 * extractor sets `featureId` / `role` itself. A *group extractor* (flag `perBody: false`) sees
 * every selected body at once: `(bodies, ctx) => descriptors`.
 */ const AXES = Object.freeze([
    'u',
    'v'
]);
const EDGE_KEYS = Object.freeze([
    'min',
    'center',
    'max'
]);
const edgeValue = (bounds, axis, edge)=>{
    if (edge === 'min') return bounds.min[axis];
    if (edge === 'max') return bounds.max[axis];
    return (bounds.min[axis] + bounds.max[axis]) / 2;
};
/**
 * Axis features at the body edges/centre: `edges({ u: ['min', 'center', 'max'], v: ['max'] })`.
 * `support: ['v.max']` adds the body's U extent as `supportIntervalUM` to those features (used by
 * the `overlap-u` / `abut-u` rule conditions, e.g. "rests on top of").
 */ const edges = (spec = {
    u: EDGE_KEYS,
    v: EDGE_KEYS
}, { support = [] } = {})=>{
    for (const axis of Object.keys(spec)){
        if (!AXES.includes(axis)) throw new TypeError(`edges(): unknown axis "${axis}"`);
        for (const edge of spec[axis]){
            if (!EDGE_KEYS.includes(edge)) throw new TypeError(`edges(): unknown edge "${edge}"`);
        }
    }
    const supported = new Set(support);
    return (body)=>{
        const out = [];
        for (const axis of AXES){
            for (const edge of spec[axis] ?? []){
                const key = `${axis}.${edge}`;
                out.push({
                    key,
                    geometry: {
                        kind: 'axis',
                        axis,
                        valueM: edgeValue(body.boundsUV, axis, edge)
                    },
                    ...supported.has(key) ? {
                        supportIntervalUM: {
                            min: body.boundsUV.min.u,
                            max: body.boundsUV.max.u
                        }
                    } : {}
                });
            }
        }
        return out;
    };
};
/**
 * Corner point features: `corners(['min.max', 'max.max'])` — `<u edge>.<v edge>` pairs.
 * Keys are `corner.<u edge>.<v edge>`.
 */ const corners = (list = [
    'min.min',
    'min.max',
    'max.min',
    'max.max'
], { support = false } = {})=>{
    const parsed = list.map((item)=>{
        const [uEdge, vEdge] = String(item).split('.');
        if (!EDGE_KEYS.includes(uEdge) || !EDGE_KEYS.includes(vEdge)) throw new TypeError(`corners(): bad corner "${item}"`);
        return [
            uEdge,
            vEdge
        ];
    });
    return (body)=>parsed.map(([uEdge, vEdge])=>({
                key: `corner.${uEdge}.${vEdge}`,
                geometry: {
                    kind: 'point',
                    pointM: {
                        u: edgeValue(body.boundsUV, 'u', uEdge),
                        v: edgeValue(body.boundsUV, 'v', vEdge)
                    }
                },
                ...support ? {
                    supportIntervalUM: {
                        min: body.boundsUV.min.u,
                        max: body.boundsUV.max.u
                    }
                } : {}
            }));
};
/**
 * Seams between neighbouring bodies along an axis: one axis feature per pair of bodies whose
 * extents touch (within `epsilonM`), keyed `joint.<index>` in order. A group extractor.
 */ const joints = ({ axis = 'u', epsilonM = 1e-6 } = {})=>{
    const extractor = (bodies)=>{
        const sorted = [
            ...bodies
        ].sort((a, b)=>a.boundsUV.min[axis] - b.boundsUV.min[axis]);
        const out = [];
        for(let index = 0; index + 1 < sorted.length; index += 1){
            const left = sorted[index];
            const right = sorted[index + 1];
            if (Math.abs(left.boundsUV.max[axis] - right.boundsUV.min[axis]) > epsilonM) continue;
            out.push({
                key: `joint.${out.length}`,
                ownerObjectId: left.id,
                partId: `${left.id}|${right.id}`,
                geometry: {
                    kind: 'axis',
                    axis,
                    valueM: (left.boundsUV.max[axis] + right.boundsUV.min[axis]) / 2
                }
            });
        }
        return out;
    };
    extractor.perBody = false;
    return extractor;
};

export { corners, edges, joints };
