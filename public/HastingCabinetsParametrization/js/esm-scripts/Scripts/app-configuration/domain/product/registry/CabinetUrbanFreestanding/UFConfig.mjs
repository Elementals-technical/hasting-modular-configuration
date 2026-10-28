/** UF depths in cm, as in the price list: 46 (UI default, 18.1") and 50 (19.7"). The guide's 45 is gone. */ const UF_DEPTHS = Object.freeze([
    46,
    50
]);
const UF_BASEBOARD_PROFILE = {
    templateName: "UF_M_Leg",
    meshName: "UF_Filler_Leg",
    depthPointName: "UF_Filler_Leg_Point",
    baseWidthM: 0.6,
    depth: {
        46: {
            stretchZ: -0.04,
            moveZ: -0.02
        },
        50: {
            stretchZ: 0,
            moveZ: 0
        }
    }
};
const UF_BASEBOARD_PRODUCT_TYPES = new Set([
    "UF-side-cabinet",
    "UF-sink-cabinet",
    "UF-open-shelves",
    "UF-open-shelves-side"
]);

export { UF_BASEBOARD_PRODUCT_TYPES, UF_BASEBOARD_PROFILE, UF_DEPTHS };
