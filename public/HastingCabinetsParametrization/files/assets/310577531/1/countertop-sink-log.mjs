/**
 * Debug log: countertop / sink / cabinets — world positions, sizes (AABB) and links (owner, host, parent, landing).
 * Off by default. On: URL `?debug=true` or `?sinkLog=1`, or `window.__SINK_LOG__ = true` at runtime (`= false` silences it).
 * The adapter logs every change of zone / owner / landing during a drag, plus every commit and restore.
 * Any time: `countertopSinkDump()` in the console prints the current snapshot.
 */

export function isSinkLogEnabled() {
    try {
        if (globalThis.__SINK_LOG__ === false) return false;
        return globalThis.__SINK_LOG__ === true || /[?&](sinkLog=1|debug=true)(&|$)/.test(String(globalThis.location?.search ?? ''));
    } catch {
        return false;
    }
}

// One line at load: proves this module (the local working tree) is the one running.
if (isSinkLogEnabled()) console.info('[sink-log] on — logs on every zone / owner / landing change; countertopSinkDump() prints a snapshot');

const mm = value => (Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null);
const vec = p => (p ? [mm(p.x), mm(p.y), mm(p.z)] : null);

/** `{ min, max, size }` of a measured `{ minM, maxM }` box (m, rounded to mm); null when unmeasured. */
export function boxInfo(box) {
    if (!box) return null;
    return {
        min: vec(box.minM),
        max: vec(box.maxM),
        size: [mm(box.maxM.x - box.minM.x), mm(box.maxM.y - box.minM.y), mm(box.maxM.z - box.minM.z)]
    };
}

/** World position `[x, y, z]` of an entity (rounded to mm); null without one. */
export function positionOf(entity) {
    try {
        return vec(entity?.getPosition?.());
    } catch {
        return null;
    }
}

const text = value => (Array.isArray(value) ? value.join(', ') : value ?? '—');

/** One collapsed console group: a summary line, the full snapshot object and a table of the bodies. */
export function logSinkSnapshot(tag, snapshot, { force = false } = {}) {
    if (!snapshot || (!force && !isSinkLogEnabled())) return;
    const o = snapshot.offset ?? {};
    console.groupCollapsed(`[sink-log] ${tag} | zone=${snapshot.zone} owner=${snapshot.ownerBefore ?? '—'}→${snapshot.owner ?? '—'}` +
        ` landing=${snapshot.landing?.status ?? '—'} offset=(${mm(o.x)}, ${mm(o.y)})` +
        ` sink=${text(snapshot.sinks?.[0]?.pos)} topX=[${text([snapshot.countertop?.box?.min?.[0], snapshot.countertop?.box?.max?.[0]])}]` +
        (snapshot.reasons?.length ? ` reasons=${snapshot.reasons.join(',')}` : ''));
    console.log(snapshot);
    const rows = [];
    const top = snapshot.countertop;
    if (top) rows.push({ role: 'countertop', id: top.id, link: top.root, pos: text(top.pos), min: text(top.box?.min), max: text(top.box?.max), size: text(top.box?.size) });
    for (const sink of snapshot.sinks ?? []) {
        rows.push({ role: 'sink', id: sink.sinkId, link: `host ${sink.host} · parent ${sink.parent} · anchor ${sink.anchor}`,
            pos: text(sink.pos), min: text(sink.box?.min), max: text(sink.box?.max), size: text(sink.box?.size) });
    }
    for (const cabinet of snapshot.cabinets ?? []) {
        rows.push({ role: `cabinet ${cabinet.type ?? ''}`.trim(), id: cabinet.id, link: cabinet.overlapsTopX ? 'under the top (X)' : 'not under the top',
            pos: text(cabinet.pos), min: text(cabinet.box?.min), max: text(cabinet.box?.max), size: text(cabinet.box?.size) });
    }
    console.table(rows);
    console.groupEnd();
}
