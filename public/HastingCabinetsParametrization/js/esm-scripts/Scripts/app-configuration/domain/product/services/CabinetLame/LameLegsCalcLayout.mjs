import { isLameCabinet } from './LameUndertopCalcLayout.mjs';

const LAME_LEGS_PROFILE = Object.freeze({
    templateName: 'Lame_Legs',
    rightMoveX: Object.freeze({
        40: -0.2,
        60: 0,
        80: 0.2,
        100: 0.25,
        120: 0.3
    }),
    baseHeightM: Object.freeze({
        26: 0.3022,
        52: 0.561
    })
});
/** One pair for the whole Lame composition; use each outer cabinet's width. */ function calculateLameLegsLayout(items, panels = {}) {
    const cabinets = items.filter(isLameCabinet);
    if (!cabinets.length || !cabinets.some((item)=>item.ShowLegs === 'Enable' || item.ShowLegs === true)) return {
        status: 'empty'
    };
    if (items.some((item)=>item.category === 'cabinets' && !isLameCabinet(item))) return {
        status: 'unsupported',
        reason: 'mixed-collections'
    };
    if (cabinets.some((item)=>!Object.hasOwn(LAME_LEGS_PROFILE.rightMoveX, Number(item.Width)) || Number(item.Depth) !== 52)) return {
        status: 'unsupported',
        reason: 'unsupported-dimensions'
    };
    const height = Number(cabinets[0].Height);
    if (![
        26,
        52
    ].includes(height) || cabinets.some((item)=>Number(item.Height) !== height)) return {
        status: 'unsupported',
        reason: 'mixed-or-unsupported-heights'
    };
    if (cabinets.some((item)=>!Number.isFinite(item.minX) || !Number.isFinite(item.maxX))) return {
        status: 'unsupported',
        reason: 'cabinet-bounds-not-ready'
    };
    const ordered = [
        ...cabinets
    ].sort((a, b)=>a.minX - b.minX);
    const left = ordered[0], right = ordered.at(-1);
    return {
        status: 'ready',
        height,
        baseHeightM: LAME_LEGS_PROFILE.baseHeightM[height],
        left: {
            x: (left.minX + left.maxX) / 2 - LAME_LEGS_PROFILE.rightMoveX[Number(left.Width)] + (panels.left ? 0 : 0.052),
            z: panels.left ? 0 : -3e-3,
            scaleX: -1,
            config: left
        },
        right: {
            x: (right.minX + right.maxX) / 2 + LAME_LEGS_PROFILE.rightMoveX[Number(right.Width)] + (panels.right ? 0 : -0.052),
            z: panels.right ? 0 : -3e-3,
            scaleX: 1,
            config: right
        }
    };
}

export { LAME_LEGS_PROFILE, calculateLameLegsLayout };
