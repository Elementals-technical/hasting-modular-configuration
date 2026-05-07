/** Countertop Style → SKU code */
export const countertopStyleSkuMap: Record<string, string> = {
  plain: "X",
  integrated: "INTG",
  vessel: "VES",
  undermount: "UDMT",
};

/** Material name → MaterialSKU */
export const countertopMaterialSkuMap: Record<string, string> = {
  Fenix: "FX",
  HPL: "HPL",
  Porcelain: "POR",
  "Glass Matt": "GLSM",
  "Glass Gloss": "GLSG",
  Minermalmaro: "SSMMO",
  Tekormud: "SSTM",
  Ocritech: "SSOCR",
  Tekorlux: "SSTKR",
  Syntesi: "SSSYN",
};

const countertopMaterialSkuByColorCode: Record<string, string> = {
  T1C: "SSOCR",
  T1D: "SSOCR",
  TAN: "SSSYN",
  TAP: "SSSYN",
};

type BasinMaterialSkuRule = {
  match: string;
  sku: string;
  strategy: "exact" | "prefix";
};

const countertopBasinMaterialSkuRules: BasinMaterialSkuRule[] = [
  { match: "Top_Tekorlux_Syntesi", sku: "SSSYN", strategy: "exact" },
  { match: "Top_Tekorlux_", sku: "SSTKR", strategy: "prefix" },
  { match: "Top_Tekormud_", sku: "SSTM", strategy: "prefix" },
  { match: "Top_Tekorund_", sku: "SSTM", strategy: "prefix" },
  { match: "Top_Ocritech_", sku: "SSOCR", strategy: "prefix" },
  { match: "Top_Mineralmarmo_", sku: "SSMMO", strategy: "prefix" },
  { match: "Top_Porcelain_", sku: "POR", strategy: "prefix" },
  { match: "Top_HPL/Fenix_", sku: "FX", strategy: "prefix" },
  { match: "Fenix_Strip_Gres", sku: "FX", strategy: "exact" },
  { match: "Top_HPL", sku: "HPL", strategy: "prefix" },
];

export const resolveCountertopMaterialSkuFromBasinType = (basinType: string | null): string | null => {
  const basin = basinType?.trim() ?? "";
  if (!basin) return null;

  const rule = countertopBasinMaterialSkuRules.find(({ match, strategy }) =>
    strategy === "exact" ? basin === match : basin.startsWith(match),
  );

  return rule?.sku ?? null;
};

export const resolveCountertopMaterialSkuFromColorCode = (colorCode: string | null): string | null => {
  const normalizedColorCode = colorCode?.trim().toUpperCase() ?? "";
  if (!normalizedColorCode) return null;

  return countertopMaterialSkuByColorCode[normalizedColorCode] ?? null;
};

/** PlayCanvas sinkType → Basin SKU code */
export const basinSkuMap: Record<string, string> = {
  Top_HPLPrisma: "PRISMA",
  Top_HPLQuadra: "QUAD",
  Top_HPLCover: "COVER",
  Top_HPLStrip: "STRIP",
  "Top_HPL/Fenix_Cover_Gres": "COVER",
  "Top_HPL/Fenix_Prisma_Gres": "PRISMA",
  "Top_HPL/Fenix_Quadra_Gres": "QUAD",
  "Top_HPL/Fenix_Strip_Gres": "STRIP",
  Fenix_Strip_Gres: "STRIP",
  Top_Glass_Nettuno: "NET",
  Top_Glass_Ovale: "OVL",
  Top_Mineralmarmo_Diamond: "DIA",
  Top_Ocritech_Oly55: "OLY55",
  Top_Ocritech_Oly56: "OLY56",
  Top_Ocritech_Orion: "ORION",
  Top_Ocritech_Quadra: "QUAD",
  Top_Ocritech_Rayo: "RAYO",
  Top_Ocritech_Roll: "ROLL",
  Top_Porcelain_Cover: "COVER",
  Top_Porcelain_Prisma: "PRISMA",
  Top_Porcelain_Quadra: "QUAD",
  Top_Porcelain_Strip: "STRIP",
  Top_Tekorlux_Syntesi: "SYNT",
  Top_Tekorlux_Quadra: "QUAD",
  Top_Tekorlux_Rectangular: "RECT",
  Top_Tekorlux_Trip: "TRIP",
  Top_Tekorlux_Ron: "RON",
  Top_Tekormud_Tivi: "TIVI",
};
