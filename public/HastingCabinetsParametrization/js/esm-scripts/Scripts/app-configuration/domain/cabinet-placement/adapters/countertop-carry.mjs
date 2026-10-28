import { trapHostIds } from '../../countertop/trap/trap-keepout.mjs';
import { isCountertopAttached } from '../../countertop/countertop-layout-policy.mjs';

const finite = (v)=>typeof v === 'number' && Number.isFinite(v);
const finiteXY = (p)=>finite(p?.x) && finite(p?.y);
const xyz = (p)=>p ? {
        x: p.x,
        y: p.y,
        z: p.z
    } : null;
/** Does the top ({ box, traps }) rest on cabinet `cabinetId` whose box is `box`: the cabinet hosts its trap. */ function countertopRestsOn(countertop, { cabinetId, box, contactM = 0 } = {}) {
    const traps = countertop?.traps ?? [], ctBox = countertop?.box ?? null;
    if (!cabinetId || !box || !ctBox || !traps.some((trap)=>trap?.hostCabinetId === cabinetId)) return false;
    return trapHostIds({
        traps,
        bodies: [
            {
                id: cabinetId,
                box
            }
        ],
        ctBottomM: ctBox.minM.y,
        contactM
    }).has(cabinetId);
}
/** Another sink base hosts a trap of this top too: the top is shared (tandem vanities). */ function countertopSharedWithOtherSinkBase(countertop, cabinetId) {
    return (countertop?.traps ?? []).some((trap)=>trap?.hostCabinetId != null && trap.hostCabinetId !== cabinetId);
}
/** The top without the traps of sink base `cabinetId` (it takes them along when it leaves a shared top). */ function countertopWithoutSinkBase(countertop, cabinetId) {
    if (!countertop || !cabinetId || !(countertop.traps ?? []).some((trap)=>trap?.hostCabinetId === cabinetId)) return countertop;
    return {
        ...countertop,
        traps: countertop.traps.filter((trap)=>trap?.hostCabinetId !== cabinetId)
    };
}
/**
 * The top the draft's rules see with the cabinet at `toM`: carried with it (`carry`), without the moved SB's traps
 * when it leaves a top shared with another SB, else as measured.
 */ function draftCountertop(countertop, { carry = null, cabinetId = null, toM = null } = {}) {
    if (carry) return carry.at(toM);
    return countertopSharedWithOtherSinkBase(countertop, cabinetId) ? countertopWithoutSinkBase(countertop, cabinetId) : countertop;
}
/** The top with its box and the SB's traps shifted by the SB's move `fromM` -> `toM` (Z stays: rear-aligned). */ function carriedCountertop(countertop, carry, toM) {
    const { cabinetId, fromM } = carry ?? {};
    if (!countertop || !finiteXY(fromM) || !finiteXY(toM)) return countertop;
    const dx = toM.x - fromM.x, dy = toM.y - fromM.y, shift = (p)=>({
            x: p.x + dx,
            y: p.y + dy,
            z: p.z
        });
    return {
        ...countertop,
        box: {
            minM: shift(countertop.box.minM),
            maxM: shift(countertop.box.maxM)
        },
        traps: countertop.traps.map((trap)=>trap.hostCabinetId === cabinetId ? {
                ...trap,
                xM: trap.xM + dx
            } : trap),
        // The carried top takes its cut-outs along (basin clearance, HR-PL-12/13).
        ...countertop.cutouts ? {
            cutouts: countertop.cutouts.map((c)=>({
                    ...c,
                    minX: c.minX + dx,
                    maxX: c.maxX + dx
                }))
        } : {}
    };
}
/**
 * @param {object} input
 * @param {{box, traps, root?}|null} input.countertop  the top as the draft measured it (root: its scene entity)
 * @param {string} input.cabinetId   the moved cabinet
 * @param {{x,y,z}} input.fromM      its starting pivot
 * @param {{minM,maxM}|null} input.box  its box at `fromM`
 * @param {number} [input.contactM]  pack contact tolerance
 * @returns the carry, or null when the cabinet carries no top
 */ function createCountertopCarry({ countertop, cabinetId, fromM, box, contactM = 0 } = {}) {
    if (!finiteXY(fromM) || !countertopRestsOn(countertop, {
        cabinetId,
        box,
        contactM
    })) return null;
    // Two SBs under one top: the other keeps it (tandem vanities).
    if (countertopSharedWithOtherSinkBase(countertop, cabinetId)) return null;
    const from = {
        ...fromM
    }, root = countertop.root ?? null;
    const worldM = xyz(root?.getPosition?.()), localM = xyz(root?.getLocalPosition?.());
    const usable = ()=>root && worldM && !root.destroyed;
    let shown = false;
    return {
        get shown () {
            return shown;
        },
        at: (toM)=>carriedCountertop(countertop, {
                cabinetId,
                fromM: from
            }, toM),
        show (toM) {
            if (!usable() || !finiteXY(toM)) return;
            try {
                root.setPosition(worldM.x + toM.x - from.x, worldM.y + toM.y - from.y, worldM.z);
                shown = true;
            } catch  {}
        },
        hide () {
            if (!shown || !usable()) return;
            try {
                if (localM) root.setLocalPosition(localM.x, localM.y, localM.z);
                else root.setPosition(worldM.x, worldM.y, worldM.z);
            } catch  {}
            shown = false;
        },
        commit (sources, toM) {
            if (!finiteXY(toM)) return;
            const dx = toM.x - from.x, dy = toM.y - from.y;
            for (const source of sources ?? []){
                const config = source.payload.config, offset = config.SpatialOffsetM;
                if (!(source.cabinetReferences ?? []).includes(cabinetId) || isCountertopAttached(offset)) continue;
                config.SpatialOffsetM = {
                    x: Number(offset.x ?? 0) + dx,
                    y: Number(offset.y ?? 0) + dy
                };
                if (source.payload.positionM) source.payload.positionM = {
                    ...source.payload.positionM,
                    x: source.payload.positionM.x + dx,
                    y: source.payload.positionM.y + dy
                };
            }
        }
    };
}

export { carriedCountertop, countertopRestsOn, countertopSharedWithOtherSinkBase, countertopWithoutSinkBase, createCountertopCarry, draftCountertop };
