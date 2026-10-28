/**
 * ULH designer-table footprint of a cabinet around its root pivot (pivot X centre, Y bottom, Z back):
 * x in [px - W/200, px + W/200], y in [py, py + H/100], z in [pz, pz + D/100] (W/H/D in cm).
 * Unlike the mesh bounds it ignores parts hanging below the pivot (sink bowl ~6 cm), so every row
 * stores its bottom at the cabinets' pivot level (one convention for sink and plain cabinets).
 */ const read = (snapshot, key)=>typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key];
/** snapshot -> { widthM, heightM, depthM } | null (needs category 'cabinets' + finite positive W/H/D). */ function cabinetDimensionsM(snapshot) {
    if (!snapshot || read(snapshot, 'category') !== 'cabinets') return null;
    const [w, h, d] = [
        'Width',
        'Height',
        'Depth'
    ].map((key)=>Number(read(snapshot, key)));
    if (![
        w,
        h,
        d
    ].every((v)=>Number.isFinite(v) && v > 0)) return null;
    return {
        widthM: w / 100,
        heightM: h / 100,
        depthM: d / 100
    };
}
/** (pivot {x,y,z}, snapshot) -> { minM, maxM } | null */ function cabinetFootprintBox(pivot, snapshot) {
    const dims = cabinetDimensionsM(snapshot);
    if (!dims || !pivot || ![
        'x',
        'y',
        'z'
    ].every((axis)=>Number.isFinite(pivot[axis]))) return null;
    return {
        minM: {
            x: pivot.x - dims.widthM / 2,
            y: pivot.y,
            z: pivot.z
        },
        maxM: {
            x: pivot.x + dims.widthM / 2,
            y: pivot.y + dims.heightM,
            z: pivot.z + dims.depthM
        }
    };
}
/* ---- Plan A: ONE level convention. A cabinet's LEVEL is its pivot Y (body bottom). Meshes stay the
 * source of X/Z extents and of collisions; only the level (box.minM.y fed to row logic) is the pivot. ---- */ const finite = (v)=>typeof v === 'number' && Number.isFinite(v);
/** entity | {x,y,z} -> pivot Y (m) | null. The one and only way to read a cabinet level. */ function cabinetLevelM(entityOrPivot) {
    const p = typeof entityOrPivot?.getPosition === 'function' ? entityOrPivot.getPosition() : entityOrPivot;
    return finite(p?.y) ? p.y : null;
}
/** (meshBox {minM,maxM}, levelM) -> the same box with minM.y = levelM (X/Z untouched). Null-safe. */ function withLevel(box, levelM) {
    if (!box?.minM || !box?.maxM || !finite(levelM)) return box ?? null;
    return {
        minM: {
            ...box.minM,
            y: levelM
        },
        maxM: {
            ...box.maxM,
            y: Math.max(box.maxM.y, levelM)
        }
    };
}
/**
 * Old rows may store bottomM at the MESH bottom (a sink row ~6 cm below its cabinets' pivot).
 * rows: [{ bottomM, orderedCabinetIds }], levelOf: id -> level (m) | null.
 * -> { rows, changedIds }: bottomM = min member level when it differs by more than epsM. Pure, idempotent;
 * no cabinet moves (only the row's stored level).
 */ function normalizeRowLevels(rows, levelOf, { epsM = 1e-4 } = {}) {
    const changedIds = [];
    const out = (Array.isArray(rows) ? rows : []).map((row)=>{
        const levels = (row?.orderedCabinetIds ?? []).map((id)=>levelOf(id)).filter(finite);
        if (!levels.length) return row;
        const level = Math.min(...levels);
        if (finite(row.bottomM) && Math.abs(row.bottomM - level) <= epsM) return row;
        changedIds.push(row.id);
        return {
            ...row,
            bottomM: level
        };
    });
    return {
        rows: out,
        changedIds
    };
}

export { cabinetDimensionsM, cabinetFootprintBox, cabinetLevelM, normalizeRowLevels, withLevel };
