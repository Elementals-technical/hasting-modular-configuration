/**
 * Drag preview of the countertop while a sink base leaves (or joins) a top it shares with other sink bases
 * (Ryan 23.10 "remote tandem vanities"; Andriy 23.10: the top follows the SB while it is dragged, no basin standing
 * apart from its top). Presentation only: nothing is written; everything is put back before a commit or on Cancel.
 *
 * What the drag shows is what Apply will make (tandem/tandem-countertops.mjs):
 *   extend  the SB at the top's level and against the others (any top), or set apart at that level (thick top):
 *           the one top spans the other cabinets and the SB's preview, cut by the preview's sink;
 *   split   a thin top, the SB set apart: the top shrinks to the other cabinets and a clone of it lies on the preview;
 *   shrink  a thick top, the SB at another level (HR-PL-11 refuses it): the top shrinks, the SB has none.
 *
 * Join (config 15280, Andriy 23.10): a thick top on ONE SB (it carries the top, countertop-carry.mjs) dragged level with
 * another SB row (its own group, a cover on it) — Apply extends the top over both rows (cabinet-rows-layout.mjs
 * assignSupportGroups extendsTop), so the drag shows that: the same preview in 'extend' with `others` = the level row
 * (`pickLevelRows`) and the top raised/lowered to that row's level (`home`). Off that level the carry shows again.
 *
 * planSplitPreview is the pure decision; createCountertopSplitPreview drives the scene (the basin top's root and
 * TopSolid: SmartStretch on the uncut slab, re-cut by MeshBoolean once the pointer rests; the clone through
 * `makeTopPreview`).
 *
 * Smooth (Andriy 23.10: "the top moves in jumps"): the length and the pose of the top change in the same frame. A cut
 * mesh mutes SmartStretch until the next CSG run, and a run waits for MeshBoolean's quiet period, which a moving pointer
 * never gives — so the length lagged behind the pose. While the top changes it shows its uncut slab (as the basin top's
 * own drag does, countertop-composition-adapter `restoreSourceMesh`), stretched at once; the holes come back when the
 * pointer rests (the debounced re-cut). Until then green markers show where the slab will be cut (Andriy 23.10:
 * countertop-cutout-markers.mjs, the dragged cabinet's veil).
 */
import { createCountertopGeometryAdapter } from '../../countertop/adapters/countertop-geometry-adapter.mjs';
const PREVIEW_REASON = 'countertop-split-preview';
import { COUNTERTOP_INTRINSIC_LENGTH_M } from '../../countertop/countertop-layout-policy.mjs';
import { SINK_BASE_LEVEL_TOLERANCE_M, TANDEM_COUNTERTOP_ROLE, tandemConfigFrom } from '../../countertop/tandem/tandem-countertops.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
/** A dropped cabinet this close to a row end joins that row (cabinet-rows.mjs DEFAULT_ROW_TOLERANCES.contactM). */
const JOIN_GAP_M = 0.005;

/**
 * @param {{ thin: boolean, others: { minX, maxX, sinkTopY: number|null }, candidate: { minX, maxX, topY } }} input
 *   others: the X extent of the cabinets the top keeps and the top of their sink bases (null: none)
 * @returns {{ mode: 'extend'|'split'|'shrink', main: { minX, maxX }, clone: { minX, maxX }|null }}
 */
export function planSplitPreview({ thin, others, candidate, levelM = SINK_BASE_LEVEL_TOLERANCE_M, joinM = JOIN_GAP_M }) {
    const level = others.sinkTopY === null || Math.abs(candidate.topY - others.sinkTopY) <= levelM;
    const gap = Math.max(candidate.minX - others.maxX, others.minX - candidate.maxX);
    if (level && (!thin || gap <= joinM)) {
        return { mode: 'extend', main: { minX: Math.min(others.minX, candidate.minX), maxX: Math.max(others.maxX, candidate.maxX) }, clone: null };
    }
    const main = { minX: others.minX, maxX: others.maxX };
    return thin ? { mode: 'split', main, clone: { minX: candidate.minX, maxX: candidate.maxX } } : { mode: 'shrink', main, clone: null };
}

/**
 * The SB rows a thick top on the dragged SB joins at `candidate` (their sink base tops level with its top), merged:
 * { minX, maxX, sinkTopY, cutters } or null when none is level.
 * @param {{ minX, maxX, sinkTopY: number, cutters?: object[] }[]} rows
 */
export function pickLevelRows(rows, candidate, levelM = SINK_BASE_LEVEL_TOLERANCE_M) {
    const level = (rows ?? []).filter(row => finite(row?.sinkTopY) && candidate && Math.abs(candidate.topY - row.sinkTopY) <= levelM);
    if (!level.length) return null;
    return { minX: Math.min(...level.map(row => row.minX)), maxX: Math.max(...level.map(row => row.maxX)),
        sinkTopY: Math.max(...level.map(row => row.sinkTopY)), cutters: level.flatMap(row => row.cutters ?? []) };
}

const isUnder = (node, root) => { for (let n = node; n; n = n.parent) if (n === root) return true; return false; };

/**
 * @param {object} input
 * @param {{ root, mesh, box: {minM,maxM}, lengthM: number, config: object }} input.countertop  the basin top at drag start
 * @param {{ minX, maxX }} input.groupExtent  X extent of every cabinet under the top at drag start (its end allowances
 *   — side panels — are kept: the preview top keeps the same overhang at each end)
 * @param {{ minX, maxX, sinkTopY: number|null }} input.others  the cabinets the top keeps (the moved SB left out)
 * @param {boolean} input.thin
 * @param {{ topY: number }|null} [input.home]  join: the top of the SB the top rests on at drag start — the top keeps
 *   that height over it; 'extend' lifts it by others.sinkTopY - home.topY (null: the others keep it where it is)
 * @param {object|null} input.sourceRoot  a moved SB's own entity (its cutters leave the top), null for an added SB
 * @param {(config) => Promise<{entity, dispose}>} input.makeTopPreview  a detached top entity (for the clone)
 * @param {(entity) => object[]} input.cuttersOf  the BoolB_ cutters under an SB entity's sink mount
 * @param {(entity) => {minM,maxM}|null} input.measure  world box of an entity's TopSolid
 * @returns the preview: { shown, mode, update(candidate, previewEntity), hide(), dispose() }
 */
export function createCountertopSplitPreview({ countertop, groupExtent, others, thin, sourceRoot = null, makeTopPreview, cuttersOf, measure,
    markers = null, footprintOf = null, home = null }) {
    const { root, mesh } = countertop;
    const meshBoolean = mesh?.script?.meshBoolean ?? null;
    if (!root || !mesh || !meshBoolean || !countertop.box || !finite(countertop.lengthM)) return null;
    const saved = { local: { ...root.getLocalPosition() }, world: { ...root.getPosition() }, lengthM: countertop.lengthM,
        cutters: [...(meshBoolean.cutters ?? [])] };
    // Overhang of the top past the cabinets at each end (end side panels), and where its mesh centre is off its root.
    const padLeft = groupExtent.minX - countertop.box.minM.x, padRight = countertop.box.maxM.x - groupExtent.maxX;
    const pivotOffsetX = (countertop.box.minM.x + countertop.box.maxM.x) / 2 - saved.world.x;
    let shown = false, mode = null, destroyed = false, appliedLengthM = null, appliedCutters = null, touched = false;
    const stretcher = mesh.script?.smartStretch ?? null;
    /** The uncut slab at `lengthM` now (pristine source, stretcher writing again); the cut is requested by the caller. */
    const stretchNow = lengthM => {
        try { meshBoolean.restoreSourceMesh?.(PREVIEW_REASON); } catch { /* the debounced cut still comes */ }
        if (stretcher?.stretchAmount) {
            stretcher.stretchAmount.x = lengthM - COUNTERTOP_INTRINSIC_LENGTH_M;
            stretcher.updateGeometry?.();
        }
        touched = true;
    };
    const requestCut = (options = {}) =>
        Promise.resolve(meshBoolean.requestBoolean({ reason: PREVIEW_REASON, skipWhenNoActiveCutters: false, ...options })).catch(() => {});
    let clone = null, cloneLoading = null, cloneAt = null, lastCandidate = null, lastPreview = null, lastMain = null, lastY = saved.world.y;
    // Cut markers: shown over the uncut slab, hidden once the cut of the latest change has run.
    let cutGeneration = 0;
    const showMarkers = cutters => {
        if (!markers || typeof footprintOf !== 'function') return;
        try { markers.show(cutters.map(cutter => footprintOf(cutter)).filter(Boolean), countertop.box.maxM.y); }
        catch { /* presentation only */ }
    };
    const hideMarkers = () => { try { markers?.hide(); } catch { /* presentation only */ } };

    /** The top over [minX, maxX] (+ its end overhangs): its pose on every update (the layout may have put it back),
     * a new length or new cutters re-cut it (MeshBoolean's quiet period coalesces a drag). */
    const poseOf = ({ minX, maxX }) => (minX - padLeft + maxX + padRight) / 2 - pivotOffsetX;
    const setMain = ({ minX, maxX }, cutters, y = saved.world.y) => {
        const left = minX - padLeft, right = maxX + padRight, lengthM = right - left;
        lastY = y;
        root.setPosition(poseOf({ minX, maxX }), y, saved.world.z);
        root.syncHierarchy?.();
        const cuttersChanged = !appliedCutters || appliedCutters.length !== cutters.length || appliedCutters.some((c, i) => c !== cutters[i]);
        if (cuttersChanged) {
            meshBoolean.cutters = cutters;
            cutters.forEach(cutter => { cutter.enabled = true; });
            appliedCutters = cutters;
        }
        const lengthChanged = appliedLengthM === null || Math.abs(appliedLengthM - lengthM) > 1e-6;
        // The holes follow the preview's sink in 'extend': a move of it is a change too.
        if (!lengthChanged && !cuttersChanged && mode !== 'extend') return;
        appliedLengthM = lengthM;
        stretchNow(lengthM);
        const generation = ++cutGeneration;
        showMarkers(cutters);
        requestCut().then(() => { if (generation === cutGeneration && shown) hideMarkers(); });
    };
    const ownCutters = () => sourceRoot ? saved.cutters.filter(cutter => !isUnder(cutter, sourceRoot)) : saved.cutters;

    /** The clone on the SB preview: built once (async), stretched and cut once; then it moves with the preview. */
    const placeClone = () => {
        if (!clone || !lastCandidate) return;
        const entity = clone.entity;
        if (mode !== 'split') { entity.enabled = false; return; }
        entity.enabled = true;
        const centreX = (lastCandidate.minX + lastCandidate.maxX) / 2, dy = lastCandidate.topY - (others.sinkTopY ?? lastCandidate.topY);
        if (!cloneAt) {
            const lengthM = lastCandidate.maxX - lastCandidate.minX;
            const cloneGeometry = createCountertopGeometryAdapter({ entity: clone.mesh, intrinsicBaseLengthM: COUNTERTOP_INTRINSIC_LENGTH_M });
            entity.setPosition(centreX, saved.world.y + dy, saved.world.z);
            entity.syncHierarchy?.();
            const cutters = lastPreview ? cuttersOf(lastPreview) : [];
            cutters.forEach(cutter => { cutter.enabled = true; });
            const cloneBoolean = clone.mesh.script?.meshBoolean;
            if (cloneBoolean) cloneBoolean.cutters = cutters;
            Promise.resolve(cloneGeometry.setLengthM(lengthM, { force: true, booleanOptions: { reason: 'countertop-split-preview-clone', immediate: true } }))
                .catch(() => {}).finally(() => cloneGeometry.retireWithoutMutation());
            const box = measure(entity);
            const offset = box ? (box.minM.x + box.maxM.x) / 2 - entity.getPosition().x : 0;
            entity.setPosition(centreX - offset, saved.world.y + dy, saved.world.z);
            cloneAt = { centreX, dy, offset };
            return;
        }
        // Rigid with the preview: the cut moves with it.
        entity.setPosition(centreX - cloneAt.offset, saved.world.y + dy, saved.world.z);
    };
    const ensureClone = () => {
        if (clone || cloneLoading || destroyed || typeof makeTopPreview !== 'function') return;
        const config = { ...tandemConfigFrom(countertop.config), CountertopRole: TANDEM_COUNTERTOP_ROLE };
        cloneLoading = Promise.resolve().then(() => makeTopPreview(config)).then(handle => {
            const cloneMesh = handle?.entity?.findByName?.('TopSolid') ?? null;
            if (destroyed || !handle?.entity || !cloneMesh) { handle?.dispose?.(); return; }
            clone = { ...handle, mesh: cloneMesh };
            if (!shown) { clone.entity.enabled = false; return; }
            // Building a product entity may settle the scene, which lays the top out again: its preview pose back.
            if (lastMain) setMain(lastMain, appliedCutters ?? ownCutters(), lastY);
            placeClone();
        }).catch(() => { /* presentation only: no clone */ });
    };

    return {
        get shown() { return shown; },
        get mode() { return mode; },
        get clone() { return clone?.entity ?? null; },
        whenCloneReady: () => cloneLoading ?? Promise.resolve(),
        /** candidate: { minX, maxX, topY } of the SB at its preview pose; previewEntity: the SB's preview;
         * joined: the level rows a join extends over (pickLevelRows), else the `others` given at creation. */
        update(candidate, previewEntity, joined = null) {
            if (destroyed || !candidate) return;
            const kept = joined ?? others;
            const plan = planSplitPreview({ thin, others: kept, candidate });
            mode = plan.mode; shown = true; lastCandidate = candidate; lastPreview = previewEntity; lastMain = plan.main;
            const y = home && finite(home.topY) && finite(kept.sinkTopY) ? saved.world.y + kept.sinkTopY - home.topY : saved.world.y;
            setMain(plan.main, plan.mode === 'extend'
                ? [...ownCutters(), ...(kept.cutters ?? []), ...(previewEntity ? cuttersOf(previewEntity) : [])] : ownCutters(), y);
            if (plan.mode === 'split') { ensureClone(); placeClone(); } else placeClone();
        },
        /** Once per frame: the spatial world re-poses the top on its standard pose whenever it refreshes (a re-cut, a
         * capture); while shown, the preview pose wins. */
        reassert() {
            if (!shown || !lastMain || destroyed) return;
            const x = poseOf(lastMain), p = root.getPosition();
            if (Math.abs(p.x - x) > 1e-6 || Math.abs(p.y - lastY) > 1e-6) {
                root.setPosition(x, lastY, saved.world.z);
                root.syncHierarchy?.();
            }
        },
        /** Everything back as it was (the top's pose, length and cutters bit-exact); the clone hidden. */
        hide() {
            if (!shown) return;
            shown = false; mode = null; appliedLengthM = null; appliedCutters = null; lastMain = null; lastY = saved.world.y;
            if (clone) clone.entity.enabled = false;
            root.setLocalPosition(saved.local.x, saved.local.y, saved.local.z);
            root.syncHierarchy?.();
            meshBoolean.cutters = saved.cutters;
            cutGeneration++;
            hideMarkers();
            if (touched) {
                touched = false;
                stretchNow(saved.lengthM);
                touched = false;
                requestCut({ immediate: true });
            }
        },
        dispose() {
            this.hide();
            destroyed = true;
            try { markers?.destroy(); } catch { /* presentation only */ }
            const handle = clone; clone = null;
            Promise.resolve(handle?.dispose?.()).catch(() => {});
        }
    };
}
