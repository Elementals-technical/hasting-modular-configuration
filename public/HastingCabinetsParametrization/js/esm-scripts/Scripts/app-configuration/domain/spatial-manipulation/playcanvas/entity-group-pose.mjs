/**
 * Pose driver for a group of PlayCanvas entities moved together in a frame (duck-typed entities:
 * getPosition()/setPosition(), parent).
 *
 * The group's *base* world positions are captured on `rebase()`; `write({ u, v })` places every
 * target at `base + u·U + v·V`. The offset is kept exactly as written, so `read()` never drifts.
 * Targets must be top-level: a descendant of another target would be moved twice.
 */ const finite = (value)=>typeof value === 'number' && Number.isFinite(value);
const isAlive = (entity)=>Boolean(entity && entity.parent != null);
const readWorld = (entity)=>{
    const p = entity?.getPosition?.();
    return p && finite(p.x) && finite(p.y) && finite(p.z) ? {
        x: p.x,
        y: p.y,
        z: p.z
    } : null;
};
function createEntityGroupPose({ frame, resolveTargets, beforeCapture = null }) {
    if (typeof resolveTargets !== 'function') throw new TypeError('createEntityGroupPose requires resolveTargets()');
    let axes = {
        uAxis: {
            ...frame.uAxis
        },
        vAxis: {
            ...frame.vAxis
        }
    };
    let targets = [];
    const bases = new Map();
    let applied = {
        u: 0,
        v: 0
    };
    let destroyed = false;
    const delta = (offset)=>({
            x: axes.uAxis.x * offset.u + axes.vAxis.x * offset.v,
            y: axes.uAxis.y * offset.u + axes.vAxis.y * offset.v,
            z: axes.uAxis.z * offset.u + axes.vAxis.z * offset.v
        });
    const place = (offset)=>{
        const d = delta(offset);
        let moved = 0;
        for (const entity of targets){
            const base = bases.get(entity);
            if (!isAlive(entity) || !base) continue;
            entity.setPosition(base.x + d.x, base.y + d.y, base.z + d.z);
            moved += 1;
        }
        return moved;
    };
    const capture = ()=>{
        // Host hook: re-establish the standard layout (e.g. a layout-owned axis) before the bases are read.
        beforeCapture?.();
        bases.clear();
        targets = (resolveTargets() || []).filter(isAlive);
        for (const entity of targets){
            const position = readWorld(entity);
            if (position) bases.set(entity, position);
        }
    };
    /** Subtract the applied offset from the current (live) positions of the current targets. */ const removeApplied = ()=>{
        if (applied.u === 0 && applied.v === 0) return;
        const d = delta(applied);
        for (const entity of targets){
            const current = readWorld(entity);
            if (!isAlive(entity) || !current) continue;
            entity.setPosition(current.x - d.x, current.y - d.y, current.z - d.z);
        }
    };
    capture();
    return Object.freeze({
        read: ()=>({
                u: applied.u,
                v: applied.v
            }),
        write (offset) {
            if (destroyed) throw new Error('entity group pose destroyed');
            if (targets.length === 0 || bases.size === 0) throw new Error('entity group pose has no live targets');
            const moved = place(offset);
            if (moved !== bases.size) throw new Error(`entity group pose moved ${moved} of ${bases.size} targets`);
            applied = {
                u: offset.u,
                v: offset.v
            };
        },
        /**
     * Re-resolve the targets and recapture their base after the host re-laid them out.
     * `mode: 'live'` (default) treats the current positions as base + applied offset; `mode:
     * 'standard'` treats them as the new standard base. The offset is re-applied either way.
     */ rebase ({ mode = 'live', frame: nextFrame = null } = {}) {
            if (destroyed) return;
            if (mode === 'live') removeApplied();
            if (nextFrame) axes = {
                uAxis: {
                    ...nextFrame.uAxis
                },
                vAxis: {
                    ...nextFrame.vAxis
                }
            };
            capture();
            place(applied);
        },
        /**
     * Put every target on its base but keep the offset: the host re-lays the targets out, then
     * `rebase({ mode: 'standard' })` captures the new base and re-applies the offset.
     */ suspend () {
            if (destroyed) return;
            place({
                u: 0,
                v: 0
            });
        },
        /** Put every target back on its base and forget the offset. */ restoreStandard () {
            place({
                u: 0,
                v: 0
            });
            applied = {
                u: 0,
                v: 0
            };
        },
        get targetCount () {
            return bases.size;
        },
        destroy ({ restoreStandard = true } = {}) {
            if (destroyed) return;
            if (restoreStandard) place({
                u: 0,
                v: 0
            });
            destroyed = true;
            targets = [];
            bases.clear();
        }
    });
}

export { createEntityGroupPose };
