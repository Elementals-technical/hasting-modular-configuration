import type { AttributeValue } from "../model/types";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";
const COUNTERTOP_PARENT_NAME = "Countertop Color";

const COUNTERTOP_GLASS_FAMILY_BY_FINISH: Record<string, string> = {
  mt: "Glass MT",
  gl: "Glass GL",
};
const LACQUERED_FINISH_MATERIAL_PATTERN = /^lacquered\s+(mt|gl)$/i;
const VARIANT_FINISH_SUFFIX_PATTERN = /\b(MT|GL)\b$/i;

const resolveImageUrl = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${raw}`;
  return raw;
};

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toNullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const normalizeOptionalString = (value: unknown): string | undefined => {
  const raw = toOptionalString(value)?.trim();
  return raw || undefined;
};

// Maps a countertop variant whose upstream Material only describes the lacquer
// finish ("Lacquered MT" / "Lacquered GL") to a Glass MT/GL family using the
// variant's value/label suffix. Tekorlux and other families that share this
// placeholder must be disambiguated upstream via `optionName`, otherwise their
// suffix would be misinterpreted as Glass.
const resolveCountertopGlassFamilyFromLacquerMaterial = (
  material: string,
  attribute: AttributeValue,
): string | undefined => {
  if (!LACQUERED_FINISH_MATERIAL_PATTERN.test(material)) return undefined;
  const candidate =
    toOptionalString(attribute?.value) ??
    toOptionalString(attribute?.metadata?.value) ??
    toOptionalString(attribute?.label) ??
    toOptionalString(attribute?.metadata?.label);
  if (!candidate) return undefined;
  const match = candidate.trim().match(VARIANT_FINISH_SUFFIX_PATTERN);
  if (!match) return undefined;
  return COUNTERTOP_GLASS_FAMILY_BY_FINISH[match[1].toLowerCase()];
};

export const AttributeHelper = {
  getImage(value: AttributeValue): string | undefined {
    const raw = value?.metadata?.image ?? value?.metadata?.Image;
    return resolveImageUrl(toOptionalString(raw));
  },

  getNeedsLightBorder(value: AttributeValue): boolean {
    const hex = toOptionalString(value?.metadata?.hex ?? value?.metadata?.Hex)?.trim();
    const isLightHex = typeof hex === "string" && /^#?(f{3}|f{6})$/i.test(hex);
    return isLightHex || value?.metadata?.lightBorder === true;
  },

  getValueLabel(attribute: AttributeValue): string {
    return (
      toOptionalString(attribute?.metadata?.label ?? attribute?.metadata?.Label) ??
      attribute?.name ??
      "Unnamed"
    );
  },

  getMaterialDisplayName(attribute: AttributeValue): string | undefined {
    const material = normalizeOptionalString(attribute?.metadata?.Material);
    const finish = normalizeOptionalString(attribute?.metadata?.Finish);
    const sku = normalizeOptionalString(attribute?.metadata?.sku);

    // For countertop swatches the upstream `Material` can be the lacquer
    // finish placeholder ("Lacquered MT" / "Lacquered GL"), which only
    // describes the surface treatment. Infer the Glass MT/GL family from the
    // variant value/label suffix in that case.
    if (attribute?.parentName === COUNTERTOP_PARENT_NAME && material) {
      const glassFamily = resolveCountertopGlassFamilyFromLacquerMaterial(material, attribute);
      if (glassFamily) return glassFamily;
    }
    return material ?? finish ?? sku;
  },

  getFinishDisplayName(attribute: AttributeValue): string {
    const label = AttributeHelper.getValueLabel(attribute);
    const code = toOptionalString(attribute?.metadata?.value ?? attribute?.value)?.trim();
    if (!code) return label;

    const normalizedLabel = label.toLowerCase();
    const normalizedCode = code.toLowerCase();
    return normalizedLabel.includes(normalizedCode) ? label : `${label} ${code}`;
  },

  getHexColor(value: AttributeValue): string | null {
    return toNullableString(value?.metadata?.hex ?? value?.metadata?.Hex);
  },
};
