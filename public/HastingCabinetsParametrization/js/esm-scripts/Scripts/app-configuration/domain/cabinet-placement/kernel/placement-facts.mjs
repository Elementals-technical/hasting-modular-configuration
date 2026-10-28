/**
 * Placement facts — the ONE engine-free view of a composition the placement kernel reasons about.
 *
 * Input geometry is already measured by an adapter (world AABB `meshBox`, root `pivotM`). A fact keeps
 * the Plan A level convention: `levelM` = pivot Y (body bottom), `topM` = level + body height. Mesh X/Z
 * extents stay the mesh. Roles/traits come from the collection pack only — nothing here knows SB/SC.
 *
 * fact = { id, productType, role, traits, levelM, topM, x:[min,max], z:[min,max], isCandidate }
 */ const finite = (v)=>typeof v === 'number' && Number.isFinite(v);
const vec = (v)=>!!v && [
        'x',
        'y',
        'z'
    ].every((k)=>finite(v[k]));
const box = (b)=>!!b && vec(b.minM) && vec(b.maxM);
/** Body height in metres: `config[heightKey]` (cm, the designer-table convention) else the mesh above the level. */ function heightM(item, levelM, { heightKey = 'Height' } = {}) {
    const cm = Number(item.config?.[heightKey]);
    if (finite(cm) && cm > 0) return cm / 100;
    return box(item.meshBox) ? Math.max(item.meshBox.maxM.y - levelM, 0) : null;
}
function buildPlacementFact(item, pack, { isCandidate = false } = {}) {
    if (!item || typeof item.id !== 'string' || !item.id) throw new TypeError('A placement item needs an id');
    const role = pack.roles?.[item.productType] ?? null;
    const levelM = vec(item.pivotM) ? item.pivotM.y : box(item.meshBox) ? item.meshBox.minM.y : null;
    const h = finite(levelM) ? heightM(item, levelM, pack.geometry) : null;
    return Object.freeze({
        id: item.id,
        productType: item.productType ?? null,
        role,
        traits: Object.freeze({
            ...pack.traits?.[role] ?? {}
        }),
        levelM,
        topM: finite(h) ? levelM + h : null,
        x: box(item.meshBox) ? Object.freeze([
            item.meshBox.minM.x,
            item.meshBox.maxM.x
        ]) : null,
        z: box(item.meshBox) ? Object.freeze([
            item.meshBox.minM.z,
            item.meshBox.maxM.z
        ]) : null,
        measured: finite(levelM) && finite(h) && box(item.meshBox),
        isCandidate
    });
}
/**
 * @param {object} input
 * @param {object} input.pack           collection pack (roles, traits, tolerances, geometry)
 * @param {object[]} input.cabinets     committed cabinets { id, productType, config, pivotM, meshBox }
 * @param {object|null} [input.candidate]  the draft (same shape); excluded from `cabinets` by id
 * @param {{status:string, collidesWith:string[], counterpartTypes?:object}|null} [input.collision]  adapter verdict; optional id -> obstacle type map
 * @param {{zones:object[], hosts:string[]}|null} [input.trap]  sink trap keep-out zones (countertop/trap) and their host cabinets
 * @param {{thick:boolean}|null} [input.countertop]  the basin top as the rules need it (null: no top known)
 * @param {object|null} [input.basin]  basin clearance facts of a sink base draft (adapters/draft-placement-facts.mjs draftBasinFacts)
 */ function buildPlacementFacts({ pack, cabinets = [], candidate = null, collision = null, trap = null, countertop = null, basin = null } = {}) {
    if (!pack) throw new TypeError('Placement facts need a collection pack');
    const list = cabinets.filter((c)=>!candidate || c.id !== candidate.id).map((c)=>buildPlacementFact(c, pack));
    if (candidate) list.push(buildPlacementFact(candidate, pack, {
        isCandidate: true
    }));
    return Object.freeze({
        cabinets: Object.freeze(list),
        candidateId: candidate?.id ?? null,
        collision: collision ? Object.freeze({
            status: collision.status,
            collidesWith: Object.freeze([
                ...collision.collidesWith ?? []
            ]),
            counterpartTypes: Object.freeze({
                ...collision.counterpartTypes
            })
        }) : null,
        trap: trap ? Object.freeze({
            zones: Object.freeze([
                ...trap.zones ?? []
            ]),
            hosts: Object.freeze([
                ...trap.hosts ?? []
            ])
        }) : null,
        countertop: countertop ? Object.freeze({
            thick: countertop.thick === true
        }) : null,
        basin: basin ? Object.freeze({
            ...basin,
            candidate: Object.freeze({
                ...basin.candidate
            }),
            cutouts: Object.freeze((basin.cutouts ?? []).map((c)=>Object.freeze({
                    ...c
                })))
        }) : null,
        tolerances: Object.freeze({
            ...pack.tolerances
        })
    });
}
/** Selector over a fact: { role:[...] } and/or { trait, eq }. Missing selector = everything.
 * Returns true / false, or null when the trait is undecided (null) — callers surface that as a gate. */ function matchesSelector(fact, selector) {
    if (!selector) return true;
    if (Array.isArray(selector.role) && !selector.role.includes(fact.role)) return false;
    if (typeof selector.trait === 'string') {
        const value = fact.traits?.[selector.trait];
        if (value === null || value === undefined) return null;
        if (Object.hasOwn(selector, 'eq') && value !== selector.eq) return false;
    }
    return true;
}

export { buildPlacementFact, buildPlacementFacts, matchesSelector };
