import classProfileDocument from "../../../../../../public/collections/class/product-profile.json";
import classSkuProfileDocument from "../../../../../../public/collections/class/sku-profile.json";
import makoProfileDocument from "../../../../../../public/collections/mako/product-profile.json";
import makoSkuProfileDocument from "../../../../../../public/collections/mako/sku-profile.json";

import { collectionSkuProfileSchema, type CollectionSkuProfile, type ProductProfile } from "@/entities/collection";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import type { CabinetDimensions, CabinetEntry, ScopedValue, ValueTarget } from "@/entities/configuration";
import type { PricingInput } from "@/shared/lib/pricing/types";
import { createSkuBuilders } from "@/shared/lib/sku";

import { pricingInput } from "./pricingScenarios";

/**
 * The reference Class and Mako orders (D04), built from C's state the way the app holds it:
 * cabinets with their sizes, and values addressed to the configuration, the countertop, each
 * basin, cabinet and drawer. The recorded answers in `prices/` are keyed by their SKUs.
 */

const parseProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error("collection profile failed validation");
  return result.profile;
};

export const CLASS = {
  profile: parseProfile(classProfileDocument),
  skuProfile: collectionSkuProfileSchema.parse(classSkuProfileDocument),
};

export const MAKO = {
  profile: parseProfile(makoProfileDocument),
  skuProfile: collectionSkuProfileSchema.parse(makoSkuProfileDocument),
};

type Collection = { profile: ProductProfile; skuProfile: CollectionSkuProfile };

export type CollectionCabinet = { stableKey: string; runtimeId: string; size: CabinetDimensions };

export const at = (target: ValueTarget, value: string): ScopedValue => ({ target, value });

/** A `PricingInput` of a collection priced from its SKU profile: no scene, no USH options. */
export const collectionPricingInput = (
  { profile, skuProfile }: Collection,
  cabinets: readonly CollectionCabinet[],
  values: Record<string, ScopedValue[]>,
  overrides: Partial<PricingInput> = {},
): PricingInput =>
  pricingInput({
    skuBuilders: createSkuBuilders({ status: "collection", collectionProfile: skuProfile }),
    activeProfile: profile,
    productIds: [],
    orderedProductIds: [],
    sceneConfigs: [],
    cabinetEntries: cabinets.map<CabinetEntry>(({ stableKey, runtimeId }, index) => ({ stableKey, runtimeId, index })),
    dimensionsByCabinet: Object.fromEntries(cabinets.map(({ stableKey, size }) => [stableKey, size])),
    configurationValues: values,
    cabinetColor: "",
    countertopColor: "",
    countertopThickness: "",
    countertopStyle: "",
    sinkType: "",
    faucetHolesAmount: "",
    ...overrides,
  });

const size = (width: number, height: number): CabinetDimensions => ({ width, height, depth: 52 });
const cabinetOf = (cabinetId: string): ValueTarget => ({ scope: "cabinet", cabinetId });
const GLOBAL: ValueTarget = { scope: "global" };
const COUNTERTOP: ValueTarget = { scope: "countertop" };

const CLASS_CABINETS: CollectionCabinet[] = [
  { stableKey: "cls-sb", runtimeId: "Sink-Base-aaa111", size: size(80, 52) },
  { stableKey: "cls-sc", runtimeId: "Sink-Cabinet-bbb222", size: size(40, 52) },
];

const MAKO_CABINETS: CollectionCabinet[] = [
  { stableKey: "mko-sb", runtimeId: "Sink-Base-ccc333", size: size(60, 52) },
  { stableKey: "mko-sc", runtimeId: "Sink-Cabinet-ddd444", size: size(60, 52) },
];

export type CollectionPricingScenarioId = "class-porcelain-integrated" | "mako-vessel-with-legs";

export const COLLECTION_PRICING_SCENARIOS: Record<
  CollectionPricingScenarioId,
  { title: string; collection: Collection; input: PricingInput }
> = {
  "class-porcelain-integrated": {
    title:
      "Class: SB 80 + SC 40, two drawers, Porcelain front with a colour frame, HPL top with VA024 and one faucet hole",
    collection: CLASS,
    input: collectionPricingInput(CLASS, CLASS_CABINETS, {
      Drawers: [at(cabinetOf("cls-sb"), "2"), at(cabinetOf("cls-sc"), "2")],
      CabinetColor: [at(GLOBAL, "CALACATTA BLACK 338")],
      CabinetSideColor: [at(GLOBAL, "Turchese 410 MT")],
      FrameColor: [at(GLOBAL, "Turchese 410 MT")],
      CountertopStyle: [at(COUNTERTOP, "integrated")],
      CountertopColor: [at(COUNTERTOP, "CALACATTA 259")],
      sinkType: [at({ scope: "basin", sinkBaseId: "cls-sb" }, "VA024")],
      FaucetHolesAmount: [at(COUNTERTOP, "1")],
    }),
  },
  "mako-vessel-with-legs": {
    title:
      "Mako: SB 60 G57 + SC 60 G50, two drawers, gloss lacquer, silver handles, legs, Solid Surface vessel top with three holes, an oak organizer",
    collection: MAKO,
    input: collectionPricingInput(MAKO, MAKO_CABINETS, {
      Drawers: [at(cabinetOf("mko-sb"), "2"), at(cabinetOf("mko-sc"), "2")],
      Handle: [at(cabinetOf("mko-sb"), "G57"), at(cabinetOf("mko-sc"), "G50")],
      HandleColor: [at(cabinetOf("mko-sb"), "Silver"), at(cabinetOf("mko-sc"), "Silver")],
      CabinetColor: [at(GLOBAL, "Grigio Argento 403 GL")],
      LegColor: [at(cabinetOf("mko-sb"), "Gold")],
      CountertopStyle: [at(COUNTERTOP, "vessel")],
      CountertopColor: [at(COUNTERTOP, "Matte White")],
      sinkType: [at({ scope: "basin", sinkBaseId: "mko-sb" }, "Iris")],
      FaucetHolesAmount: [at(COUNTERTOP, "3")],
      DividersStyle: [at({ scope: "drawer", cabinetId: "mko-sb", drawerType: "Top" }, "Oak")],
    }),
  },
};

export const COLLECTION_PRICING_SCENARIO_IDS = Object.keys(
  COLLECTION_PRICING_SCENARIOS,
) as CollectionPricingScenarioId[];
