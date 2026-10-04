import type { CollectionSkuProfile } from "@/entities/collection/model/schemas";

import { buildBookMatchingSku, type BookMatchingSkuInput } from "./buildBookMatchingSku";
import { buildCountertopSku, buildCountertopSkuIfComplete, type CountertopSkuInput } from "./buildCountertopSku";
import { buildDividerSku, type DividerSkuInput } from "./buildDividerSku";
import { buildOpenShelfSku, type OpenShelfSkuInput } from "./buildOpenShelfSku";
import { buildOpenSideShelfSku, type OpenSideShelfSkuInput } from "./buildOpenSideShelfSku";
import { buildProductBaseSku, buildProductSku, type ProductSkuInput } from "./buildProductSku";
import { buildSidePanelSku, type SidePanelSkuInput } from "./buildSidePanelSku";
import { buildTowelBarSku, type TowelBarSkuInput } from "./buildTowelBarSku";
import { buildVesselSku, type VesselSkuInput } from "./buildVesselSku";
import type { SkuProfile, SkuProfileResolution, SkuProfileUnsupportedReason } from "./skuProfile";

/**
 * The SKU builders of the active collection (D01).
 *
 * Callers build SKUs through these rather than the raw builders, so a collection without an
 * SKU profile never gets another collection's SKUs: its builders build nothing (`""`, `[]`
 * or `null`) and `status`/`reason` say why. The vessel SKU takes its series from the vessel
 * type, not from the collection, but is withheld the same way.
 */
export type SkuBuilders = {
  status: SkuProfileResolution["status"];
  reason: SkuProfileUnsupportedReason | null;
  profile: SkuProfile | null;
  /** A collection priced from its `sku-profile.json`; its lines come from `buildCollectionPricingLines`. */
  collectionProfile: CollectionSkuProfile | null;
  buildProductSku: (input: ProductSkuInput) => string;
  buildProductBaseSku: (input: ProductSkuInput) => string;
  buildOpenShelfSku: (input: OpenShelfSkuInput) => string;
  buildOpenSideShelfSku: (input: OpenSideShelfSkuInput) => string;
  buildSidePanelSku: (input: SidePanelSkuInput) => string | null;
  buildDividerSku: (input: DividerSkuInput) => string | null;
  buildTowelBarSku: (input: TowelBarSkuInput) => string | null;
  buildBookMatchingSku: (input: BookMatchingSkuInput) => string;
  buildCountertopSku: (input: CountertopSkuInput) => string[];
  buildCountertopSkuIfComplete: (input: CountertopSkuInput) => string[];
  buildVesselSku: (input: VesselSkuInput) => string;
};

const IDLE_BUILDERS: Omit<SkuBuilders, "status" | "reason" | "profile" | "collectionProfile"> = {
  buildProductSku: () => "",
  buildProductBaseSku: () => "",
  buildOpenShelfSku: () => "",
  buildOpenSideShelfSku: () => "",
  buildSidePanelSku: () => null,
  buildDividerSku: () => null,
  buildTowelBarSku: () => null,
  buildBookMatchingSku: () => "",
  buildCountertopSku: () => [],
  buildCountertopSkuIfComplete: () => [],
  buildVesselSku: () => "",
};

export const createSkuBuilders = (resolution: SkuProfileResolution): SkuBuilders => {
  if (resolution.status === "collection") {
    return {
      status: "collection",
      reason: null,
      profile: null,
      collectionProfile: resolution.collectionProfile,
      ...IDLE_BUILDERS,
    };
  }

  if (resolution.status === "unsupported") {
    return {
      status: "unsupported",
      reason: resolution.reason,
      profile: null,
      collectionProfile: null,
      ...IDLE_BUILDERS,
    };
  }

  const { profile } = resolution;

  return {
    status: "ready",
    reason: null,
    profile,
    collectionProfile: null,
    buildProductSku: (input) => buildProductSku(profile, input),
    buildProductBaseSku: (input) => buildProductBaseSku(profile, input),
    buildOpenShelfSku: (input) => buildOpenShelfSku(profile, input),
    buildOpenSideShelfSku: (input) => buildOpenSideShelfSku(profile, input),
    buildSidePanelSku: (input) => buildSidePanelSku(profile, input),
    buildDividerSku: (input) => buildDividerSku(profile, input),
    buildTowelBarSku: (input) => buildTowelBarSku(profile, input),
    buildBookMatchingSku: (input) => buildBookMatchingSku(profile, input),
    buildCountertopSku: (input) => buildCountertopSku(profile, input),
    buildCountertopSkuIfComplete: (input) => buildCountertopSkuIfComplete(profile, input),
    buildVesselSku: (input) => buildVesselSku(input),
  };
};
