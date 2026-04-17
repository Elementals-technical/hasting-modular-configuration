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

export const AttributeHelper = {
  getImage(value: AttributeValue): string | undefined {
    const raw = value?.metadata?.image ?? value?.metadata?.Image;
    return resolveImageUrl(toOptionalString(raw));
  },

  getValueLabel(attribute: AttributeValue): string {
    return (
      toOptionalString(attribute?.metadata?.label ?? attribute?.metadata?.Label) ??
      attribute?.name ??
      "Unnamed"
    );
  },

  getHexColor(value: AttributeValue): string | null {
    return toNullableString(value?.metadata?.hex ?? value?.metadata?.Hex);
  },
};
