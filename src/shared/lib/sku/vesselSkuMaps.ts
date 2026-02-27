/** PlayCanvas vessel type → SKU series code */
export const vesselSeriesSkuMap: Record<string, string> = {
  Vessel_UrbanModo: "URMOD",
  Vessel_UrbanMorris: "URMOR",
  Vessel_Blade18: "BLD18",
  Vessel_Blade11: "BLD11",
  // Vessel_Frame, Vessel_Iris, Vessel_Aquarius — series TBD
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
