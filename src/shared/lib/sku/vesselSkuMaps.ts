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

/**
 * PlayCanvas vessel type → allowed countertop material tokens (pre-normalized).
 *
 * Vessel is shown only when the selected countertop material matches at least
 * one token. Tokens use the same format as normalizeMaterialToken()
 * (lowercase, alphanumeric only).
 *
 * Series mapping:
 *   BLD  (Blade11/18)   → ceramic                        — hidden for all other materials
 *   URMOD (UrbanModo)   → solidsurface, hpl, porcelain
 *   URMOR (UrbanMorris) → fenix, tekorlux
 */
export const vesselAllowedMaterialsMap: Record<string, string[] | null> = {
  // BLD — Ceramic only, hidden when other materials are selected
  Vessel_Blade11: ["ceramic"],
  Vessel_Blade18: ["ceramic"],

  // URMOD — Solid Surface T1C (Matte White) / T1D (Matte Black), HPL, Porcelain
  Vessel_UrbanModo: ["solidsurface", "hpl", "porcelain"],

  // URMOR — Tekorlux SSTKR TAL / TAM only (matched via color code, not material name)
  Vessel_UrbanMorris: ["tal", "tam"],
};

/**
 * Dynamic countertop Vessel SKU dependencies:
 *   CT-UR{MATERIAL}-VES-{W}W-{H}H-{D}D-{MATERIAL}
 *
 * Key: material SKU token used in CT-UR{...}
 * Value: allowed thickness tokens for H-part (1 decimal), e.g. "5.1H"
 */
export const vesselDynamicThicknessByMaterialSku: Record<string, string[]> = {
  SSOCR: ["5.5H"],
  HPL: ["5.1H"],
  POR: ["5.5H"],
  SSTKR: ["5.1H", "5.5H"],
  CER: ["6.1H"],
  FX: [],
};

const normalizeToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const materialTokenToSku: Record<string, string> = {
  ssocr: "SSOCR",
  ocritech: "SSOCR",
  sstkr: "SSTKR",
  tekorlux: "SSTKR",
  tal: "SSTKR",
  tam: "SSTKR",
  hpl: "HPL",
  por: "POR",
  porcelain: "POR",
  fx: "FX",
  fenix: "FX",
  cer: "CER",
  ceramic: "CER",
  solidsurface: "SSOCR",
  sst1c: "SSOCR",
  sst1d: "SSOCR",
};

export const resolveVesselDynamicMaterialSku = (materialTokens: string[]): string | null => {
  for (const token of materialTokens) {
    const normalized = normalizeToken(token);
    if (!normalized) continue;
    const mapped = materialTokenToSku[normalized];
    if (mapped) return mapped;
  }
  return null;
};

/**
 * Returns constrained H tokens for dynamic CT vessel SKUs by material.
 * null means no extra material-specific thickness constraint.
 */
export const resolveVesselDynamicAllowedThicknessTokens = (materialTokens: string[]): string[] | null => {
  const sku = resolveVesselDynamicMaterialSku(materialTokens);
  if (!sku) return null;
  const allowed = vesselDynamicThicknessByMaterialSku[sku];
  return allowed && allowed.length > 0 ? allowed : null;
};
