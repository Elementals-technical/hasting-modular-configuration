/**
 * Overlay Texture Configuration
 *
 * Contains texture mappings for Drawer Panel Fluting and Grain Direction features.
 * Used by RuleGrainDirection and RuleDrawerPanelFluting rules.
 */ /**
 * Fluting textures for drawer panels
 * Applied to: CabinetUniBody_Overlay, Handle*_Overlay entities
 */ const FLUTING_TEXTURES = {
    FlutingVerticalA: {
        normal: "FlutVertA_N_1K",
        ao: "FlutVertA_AO_1K",
        tiling: 14,
        bumpiness: 1.1,
        intensity: 1.4
    },
    FlutingVerticalB: {
        normal: "FlutVertB_N_1K",
        ao: "FlutVertB_AO_1K",
        tiling: 28,
        bumpiness: 1.1,
        intensity: 1.4
    },
    FlutingHorizontalA: {
        normal: "FlutHoriA_N_1K",
        ao: "FlutHoriA_AO_1K",
        tiling: 14,
        bumpiness: 1.1,
        intensity: 1.4
    },
    FlutingHorizontalB: {
        normal: "FlutHoriB_N_1K",
        ao: "FlutHoriB_AO_1K",
        tiling: 28,
        bumpiness: 1.1,
        intensity: 1.4
    }
};
/**
 * Cabinet drawer overlay entity names
 * These overlays are affected by both GrainDirection and DrawerPanelFluting
 */ const DRAWER_OVERLAY_ENTITIES = [
    "HandleNoCut_Bot_Overlay",
    "HandleTopCut_Bot_Overlay",
    "HandleNoCut_Top_Overlay",
    "HandleTopCut_Top_Overlay",
    "HandleBotCut_Top_Overlay"
];
/**
 * Overlay template group names on the scene
 */ const OVERLAY_TEMPLATE_GROUPS = {
    cabinet: "CabinetUniBox_Overlay",
    sidePanelCenterG: "SidePanel_CenterG_Overlay",
    sidePanelUpperG: "SidePanel_UpperG_Overlay",
    sidePanelDoubleG: "SidePanels_DoubleG_Overlay",
    sidePanelNoG: "SidePanels_NoG_Overlay"
};
/**
 * Valid option values for DrawerPanelFluting
 */ const FLUTING_OPTIONS = [
    "None",
    "FlutingVerticalA",
    "FlutingVerticalB",
    "FlutingHorizontalA",
    "FlutingHorizontalB"
];
/**
 * Valid option values for GrainDirection
 */ const GRAIN_OPTIONS = [
    "None",
    "GrainHorizontal",
    "GrainVertical"
];

export { DRAWER_OVERLAY_ENTITIES, FLUTING_OPTIONS, FLUTING_TEXTURES, GRAIN_OPTIONS, OVERLAY_TEMPLATE_GROUPS };
