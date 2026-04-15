import type { AttributeValue } from "../model/types";

const THREEKIT_PREVIEW_BASE_URL = "https://preview.threekit.com";

const resolveImageUrl = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("/api/")) return `${THREEKIT_PREVIEW_BASE_URL}${raw}`;
  return raw;
};

export const AttributeHelper = {
  getImage(value: AttributeValue): string | undefined {
    const raw = value?.metadata?.image ?? value?.metadata?.Image;
    return resolveImageUrl(raw as string | undefined);
  },

  getValueLabel(attribute: AttributeValue): string {
    return attribute?.metadata?.label ?? attribute?.metadata?.Label ?? attribute?.name ?? "Unnamed";
  },

  getHexColor(value: AttributeValue): string | null {
    return value?.metadata?.hex ?? value?.metadata?.Hex ?? null;
  },
};
