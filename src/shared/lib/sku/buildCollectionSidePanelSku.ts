import type { CollectionOwnSidePanel, CollectionSkuProfile } from "@/entities/collection/model/schemas";
import type { ProductProfile } from "@/entities/collection/model/productProfile";
import { normalizeOptionValue, selectOption } from "@/entities/collection/lib/productProfileSelectors";
import type { ConfiguratorColorReader } from "./configuratorColors";
import { resolveCollectionColorCode, resolveCollectionColorMaterial } from "./buildCollectionSkus";

export type CollectionPanelSkuResult = { sku: string | null; quantity: number | null; reason?: string };

/** Spells an own panel only from an approved suffix/inheritance policy and explicitly supplied quantity. */
export const buildCollectionSidePanelSku = (
  panel: CollectionOwnSidePanel,
  skuProfile: CollectionSkuProfile,
  profile: ProductProfile | null,
  input: { quantity: number | null; color: string | null; readConfiguratorColor?: ConfiguratorColorReader },
): CollectionPanelSkuResult => {
  const unavailable = (reason: string): CollectionPanelSkuResult => ({ sku: null, quantity: null, reason });
  if (panel.status !== "confirmed") return unavailable(panel.reason ?? "Approved panel product data is required.");
  if (input.quantity === null || !Number.isInteger(input.quantity) || input.quantity <= 0)
    return unavailable("An explicit positive panel quantity is required.");
  if (!panel.colorAttributeId || !panel.elementCode)
    return unavailable("Approved panel color inheritance and SKU suffix are required.");
  const color = input.color && (normalizeOptionValue(profile, panel.colorAttributeId, input.color) ?? input.color);
  if (!color || !selectOption(profile, panel.colorAttributeId, color))
    return unavailable("A supported panel color is required.");
  const material = resolveCollectionColorMaterial(
    skuProfile,
    profile,
    panel.colorAttributeId,
    color,
    input.readConfiguratorColor,
  );
  const code = resolveCollectionColorCode(skuProfile, color);
  if (!material || !code) return unavailable("Panel material and color code are unresolved.");
  return { sku: `${panel.baseSku}-${panel.elementCode}-${material}-${code}`, quantity: input.quantity };
};
