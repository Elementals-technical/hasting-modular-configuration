import type { AttributeValue } from "../model/types";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";

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

  getMaterialAcronym(attribute: AttributeValue): string | undefined {
    return (
      normalizeOptionalString(attribute?.metadata?.sku) ??
      normalizeOptionalString(attribute?.metadata?.Material) ??
      normalizeOptionalString(attribute?.metadata?.Finish)
    );
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
