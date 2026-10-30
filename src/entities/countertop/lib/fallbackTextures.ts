import Cenere_TA1 from "@/shared/assets/images/materials/Cenere_TA1_Diff.jpg";
import Creta_TA3 from "@/shared/assets/images/materials/Creta_TA3_Diff.jpg";
import Ghiaccio_TA5 from "@/shared/assets/images/materials/Ghiaccio_TA5_Diff.jpg";
import Oltremare_TA4 from "@/shared/assets/images/materials/Oltremare_TA4_Diff.jpg";
import Tortora_TA2 from "@/shared/assets/images/materials/Tortora_TA2_Diff.jpg";
import Matte_Black_T1D from "@/shared/assets/images/materials/Matte_BlackT1D.jpg";
import White from "@/shared/assets/images/materials/White.jpg";
import Cenere_Matte_OCE from "@/shared/assets/images/materials/Cenere_Matte OCE.jpg";
import Cemento_Matte_OCD from "@/shared/assets/images/materials/Cemento-Matte-OCD.jpg";
import Antracite_Matte_OCF from "@/shared/assets/images/materials/Antracite_Matte OCF.jpg";
// The metallics' pictures are the configurators' own for the MT finish; the others are the scene's
// diffuse textures.
import Metallizzato_Alluminio_M1 from "@/shared/assets/images/materials/Metallizzato_Alluminio_M1.jpg";
import Metallizzato_Bronzo_M4 from "@/shared/assets/images/materials/Metallizzato_Bronzo_M4.jpg";
import Metallizzato_Antracite_M5 from "@/shared/assets/images/materials/Metallizzato_Antracite_M5.jpg";
import Metallizzato_Creta_M6 from "@/shared/assets/images/materials/Metallizzato_Creta_M6.jpg";
import Metallizzato_Copper_M7 from "@/shared/assets/images/materials/Metallizzato_Copper_M7.jpg";
import Torba_DS from "@/shared/assets/images/materials/Torba_DS.jpg";
import Rovere_Termocotto_931 from "@/shared/assets/images/materials/Rovere_Termocotto_931.jpg";
import Rovere_Oro_932 from "@/shared/assets/images/materials/Rovere_Oro_932.jpg";
import Noce_Canaletto_933 from "@/shared/assets/images/materials/Noce_Canaletto_933.jpg";
import Avenue_Plumb_TRB from "@/shared/assets/images/materials/Avenue_Plumb_TRB.jpg";
import Metal_Grey_TRD from "@/shared/assets/images/materials/Metal_Grey_TRD.jpg";

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
  M1: Metallizzato_Alluminio_M1,
  M4: Metallizzato_Bronzo_M4,
  M5: Metallizzato_Antracite_M5,
  M6: Metallizzato_Creta_M6,
  M7: Metallizzato_Copper_M7,
  DS: Torba_DS,
  "931": Rovere_Termocotto_931,
  "932": Rovere_Oro_932,
  "933": Noce_Canaletto_933,
  TRB: Avenue_Plumb_TRB,
  TRD: Metal_Grey_TRD,
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

/** A lacquer names its finish after the colour code ("Torba DS MT"), so every finish shares the code's picture. */
const FINISHES: ReadonlySet<string> = new Set(["GL", "MT", "ST"]);

const getVariantCode = (variantName: string): string | undefined => {
  const tokens = variantName.trim().toUpperCase().split(/\s+/);
  const last = tokens[tokens.length - 1];
  return last && FINISHES.has(last) && tokens.length > 1 ? tokens[tokens.length - 2] : last;
};

/** A picture for a colour the configurator gives neither a picture nor a hex: one with a hex keeps it. */
export const resolveCountertopFallbackTexture = (variantName: string, hex: string | undefined): string | undefined => {
  if (hex) return undefined;
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
