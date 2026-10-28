import { CABINET_LAYOUT_GAP_METERS } from '../../../composition/layout-constants.mjs';
import { UF_BASEBOARD_PROFILE } from '../../registry/CabinetUrbanFreestanding/UFConfig.mjs';

/** Size the authored leg for a packed UF composition without mounting anchors. */ function calculateUFBaseboardLayout(items) {
    if (!items.length) return {
        status: "empty"
    };
    if (items.some((item)=>!Number.isFinite(item.widthM) || item.widthM <= 0)) {
        return {
            status: "unsupported",
            reason: "invalid-width"
        };
    }
    const reference = items[0];
    const depthCm = Number(reference.depthCm);
    const depth = UF_BASEBOARD_PROFILE.depth[depthCm];
    if (!depth) return {
        status: "unsupported",
        reason: "unsupported-depth"
    };
    if (items.some((item)=>Number(item.depthCm) !== depthCm)) {
        return {
            status: "unsupported",
            reason: "mixed-depths"
        };
    }
    const widthM = items.reduce((sum, item)=>sum + item.widthM, 0) + CABINET_LAYOUT_GAP_METERS * (items.length - 1);
    return {
        status: "ready",
        widthM,
        stretchX: widthM - UF_BASEBOARD_PROFILE.baseWidthM,
        stretchZ: depth.stretchZ,
        moveZ: depth.moveZ,
        cabinetColor: reference.cabinetColor
    };
}

export { calculateUFBaseboardLayout };
