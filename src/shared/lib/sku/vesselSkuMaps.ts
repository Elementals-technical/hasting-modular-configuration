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
