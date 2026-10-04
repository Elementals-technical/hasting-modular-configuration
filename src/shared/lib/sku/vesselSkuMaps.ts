/** PlayCanvas vessel type → SKU series code */
export const vesselSeriesSkuMap: Record<string, string> = {
  Vessel_UrbanModo: "URMOD",
  Vessel_UrbanModo_Flat: "URMOD",
  Vessel_UrbanModo_Seam: "URMOD",
  Vessel_UrbanModo_Cover: "URMOD",
  Vessel_Aquarius: "ACQS",
  Vessel_UrbanKant: "URKNT",
  Vessel_UrbanMorris: "URMORS",
  Vessel_Blade18: "BLD18",
  Vessel_Blade11: "BLD11",
  Vessel_Cody: "CODY",
  Vessel_Milo: "MILO",
  Vessel_MiloR: "MILOR",
  Vessel_Oliver: "OLIV",
  Vessel_OliverR: "OLIVR",
};

/**
 * PlayCanvas vessel type → fixed material SKU.
 * Overrides whatever materialSku is passed to buildVesselSku.
 */
export const vesselMaterialSkuMap: Record<string, string> = {
  // Ceramic only — all other vessels use the selected countertop materialSku
  Vessel_Blade11: "CER",
  Vessel_Blade18: "CER",
};

/** Countertop material SKU → vessel material SKU. */
export const vesselMaterialSkuAliasMap: Record<string, string> = {
  SSOCR: "SS",
};

/** PlayCanvas vessel type → vessel basin height in cm (used for H dimension in SKU) */
export const vesselHeightCmMap: Record<string, number> = {
  Vessel_UrbanModo: 14,
  Vessel_Aquarius: 14,
  Vessel_UrbanMorris: 13,
  Vessel_Blade18: 15.5,
  Vessel_Blade11: 15.5,
};

/** Fixed width in inches per vessel type (overrides dynamic input) */
export const vesselFixedWidthInMap: Record<string, string> = {
  Vessel_UrbanModo: "19.7",
  Vessel_Aquarius: "18.9",
  Vessel_Blade11: "19.7",
  Vessel_UrbanMorris: "22.8",
  Vessel_Blade18: "21.7",
};

/** Fixed depth in inches per vessel type (overrides dynamic input) */
export const vesselFixedDepthInMap: Record<string, string> = {
  Vessel_UrbanModo: "13",
  Vessel_Aquarius: "13.4",
  Vessel_Blade11: "15",
  Vessel_UrbanMorris: "14.6",
  Vessel_Blade18: "15",
};

// Which countertop materials and colours each vessel accepts, and its preferred default finish,
// are product compatibility rather than SKU data: they live in the collection profile under
// ruleData.vesselCompatibility and are read by configurator-rule-core/countertop/vesselCompatibility.
