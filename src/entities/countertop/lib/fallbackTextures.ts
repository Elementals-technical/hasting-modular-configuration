import Cenere_TA1 from "@/shared/assets/images/materials/Cenere_TA1_Diff.jpg";
import Creta_TA3 from "@/shared/assets/images/materials/Creta_TA3_Diff.jpg";
import Ghiaccio_TA5 from "@/shared/assets/images/materials/Ghiaccio_TA5_Diff.jpg";
import Oltremare_TA4 from "@/shared/assets/images/materials/Oltremare_TA4_Diff.jpg";
import Tortora_TA2 from "@/shared/assets/images/materials/Tortora_TA2_Diff.jpg";
import Matte_Black_T1D from "@/shared/assets/images/materials/Matte_BlackT1D.jpg";
import White from "@/shared/assets/images/materials/White.jpg";
import Cenere_Matte_OCE from "@/shared/assets/images/materials/Cenere_Matte OCE.jpg";
import Cemento_Matte_OCD from "@/shared/assets/images/materials/Cemento_Matte OCD1.jpg";
import Antracite_Matte_OCF from "@/shared/assets/images/materials/Antracite_Matte OCF.jpg";

const FALLBACK_TEXTURES: Record<string, string> = {
  TA1: Cenere_TA1,
  TA2: Tortora_TA2,
  TA3: Creta_TA3,
  TA4: Oltremare_TA4,
  TA5: Ghiaccio_TA5,
  T1D: Matte_Black_T1D,
  T1C: White,
  OCC: White,
  OCB: White,
  OCE: Cenere_Matte_OCE,
  OCD: Cemento_Matte_OCD,
  OCF: Antracite_Matte_OCF,
};

const FALLBACK_HEX: Record<string, string> = {
  TMO: "#FFFFFF",
  TNO: "#FFFFFF",
  TD1: "#FFFFFF",
  TD2: "#FFFFFF",
  TAL: "#FFFFFF",
  TAM: "#FFFFFF",
  TAN: "#FFFFFF",
  TAP: "#FFFFFF",
};

const getVariantCode = (variantName: string): string | undefined => {
  const tokens = variantName.trim().split(/\s+/);
  return tokens[tokens.length - 1]?.toUpperCase();
};

export const resolveCountertopFallbackTexture = (variantName: string): string | undefined => {
  const code = getVariantCode(variantName);
  return code ? FALLBACK_TEXTURES[code] : undefined;
};

export const resolveCountertopFallbackHex = (variantName: string): string | undefined => {
  const code = getVariantCode(variantName);
  return code ? FALLBACK_HEX[code] : undefined;
};

// Variants that look (almost) white and need a contrasting border on light backgrounds.
const LIGHT_BORDER_NAME_PATTERNS: RegExp[] = [/\bBianco\s*0B\b/i];

export const resolveCountertopNeedsLightBorder = (variantName: string): boolean => {
  if (resolveCountertopFallbackHex(variantName)) return true;
  return LIGHT_BORDER_NAME_PATTERNS.some((pattern) => pattern.test(variantName));
};
