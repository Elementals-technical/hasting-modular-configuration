/** PlayCanvas vessel type → SKU series code */
export const vesselSeriesSkuMap: Record<string, string> = {
  Vessel_UrbanModo: "URMOD",
  Vessel_UrbanModo_Flat: "URMOD",
  Vessel_UrbanModo_Seam: "URMOD",
  Vessel_UrbanModo_Cover: "URMOD",
  Vessel_UrbanKant: "URKNT",
  Vessel_UrbanMorris: "URMOR",
  Vessel_Blade18: "BLD18",
  Vessel_Blade11: "BLD11",
  Vessel_Cody: "CODY",
  Vessel_Milo: "MILO",
  Vessel_MiloR: "MILOR",
  Vessel_Oliver: "OLIV",
  Vessel_OliverR: "OLIVR",
  // Vessel_Frame, Vessel_Iris — series TBD
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

/** PlayCanvas vessel type → vessel basin height in cm (used for H dimension in SKU) */
export const vesselHeightCmMap: Record<string, number> = {
  Vessel_UrbanModo: 14,
  Vessel_UrbanMorris: 13,
  Vessel_Blade18: 15.5,
  Vessel_Blade11: 15.5,
};

/** Fixed width in inches per vessel type (overrides dynamic input) */
export const vesselFixedWidthInMap: Record<string, string> = {
  Vessel_UrbanModo: "19.7",
  Vessel_Blade11: "19.7",
  Vessel_UrbanMorris: "22.8",
  Vessel_Blade18: "21.7",
};

/** Fixed depth in inches per vessel type (overrides dynamic input) */
export const vesselFixedDepthInMap: Record<string, string> = {
  Vessel_UrbanModo: "13",
  Vessel_Blade11: "15",
  Vessel_UrbanMorris: "14.6",
  Vessel_Blade18: "15",
};
