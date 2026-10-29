import type { CollectionOwnSidePanel, CollectionSkuProfile } from "@/entities/collection/model/schemas";
import type { ProductProfile } from "@/entities/collection/model/productProfile";
import { normalizeOptionValue, selectOption } from "@/entities/collection/lib/productProfileSelectors";
import type { CollectionValueReader } from "./buildCollectionSkus";
import type { ConfiguratorColorReader } from "./configuratorColors";
import { resolveCollectionColorCode, resolveCollectionColorMaterial } from "./buildCollectionSkus";

export type CollectionPanelSkuResult = {
  sku: string | null;
  quantity: number | null;
  /** The colour and material the SKU is spelled in, when it is spelled. */
  finish?: { color: string; materialSku: string };
  reason?: string;
};

/** Spells an own panel only from an approved suffix/inheritance policy and explicitly supplied quantity. */
export const buildCollectionSidePanelSku = (
  panel: CollectionOwnSidePanel,
  skuProfile: CollectionSkuProfile,
  profile: ProductProfile | null,
  input: {
    quantity: number | null;
    color: string | null;
    readConfiguratorColor?: ConfiguratorColorReader;
    read?: CollectionValueReader;
  },
): CollectionPanelSkuResult => {
  const unavailable = (reason: string): CollectionPanelSkuResult => ({ sku: null, quantity: null, reason });
  if (panel.status !== "confirmed") return unavailable(panel.reason ?? "Approved panel product data is required.");
  if (input.quantity === null || !Number.isInteger(input.quantity) || input.quantity <= 0)
    return unavailable("An explicit positive panel quantity is required.");
  if (!panel.colorAttributeId || !panel.elementCode)
    return unavailable("Approved panel color inheritance and SKU suffix are required.");
  const color = input.color && (normalizeOptionValue(profile, panel.colorAttributeId, input.color) ?? input.color);
  // A colour the profile lists, or one the configurator section the profile names for it offers.
  const isOffered =
    Boolean(color && selectOption(profile, panel.colorAttributeId, color)) ||
    Boolean(color && input.readConfiguratorColor?.(panel.colorAttributeId, color));
  if (!color || !isOffered) return unavailable("A supported panel color is required.");
  const material = resolveCollectionColorMaterial(
    skuProfile,
    profile,
    panel.colorAttributeId,
    color,
    input.readConfiguratorColor,
  );
  const code = resolveCollectionColorCode(skuProfile, color);
  if (!material || !code) return unavailable("Panel material and color code are unresolved.");
  let baseSku = panel.baseSku;
  if (panel.variants) {
    const matches = panel.variants.filter(({ when }) =>
      Object.entries(when).every(([attributeId, expected]) => {
        const raw = input.read?.(attributeId);
        return raw != null && (normalizeOptionValue(profile, attributeId, raw) ?? raw) === expected;
      }),
    );
    if (matches.length !== 1) return unavailable("Exactly one supported panel size and pattern variant is required.");
    baseSku = matches[0].baseSku;
  }
  return {
    sku: `${baseSku}-${panel.elementCode}-${material}-${code}`,
    quantity: input.quantity,
    finish: { color, materialSku: material },
  };
};
