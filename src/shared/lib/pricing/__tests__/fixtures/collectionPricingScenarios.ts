import classProfileDocument from "../../../../../../public/collections/class/product-profile.json";
import classSkuProfileDocument from "../../../../../../public/collections/class/sku-profile.json";
import lameProfileDocument from "../../../../../../public/collections/lame/product-profile.json";
import lameSkuProfileDocument from "../../../../../../public/collections/lame/sku-profile.json";
import makoProfileDocument from "../../../../../../public/collections/mako/product-profile.json";
import makoSkuProfileDocument from "../../../../../../public/collections/mako/sku-profile.json";
import urbanFreestandingProfileDocument from "../../../../../../public/collections/urban-freestanding/product-profile.json";
import urbanFreestandingSkuProfileDocument from "../../../../../../public/collections/urban-freestanding/sku-profile.json";
import urbanDuplexProfileDocument from "../../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexSkuProfileDocument from "../../../../../../public/collections/urban-duplex/sku-profile.json";
import urbanLowHeightProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightSkuProfileDocument from "../../../../../../public/collections/urban-low-height/sku-profile.json";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import configurator8 from "@/entities/collection/__tests__/fixtures/remote/configurator-8.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import configurator14 from "@/entities/collection/__tests__/fixtures/remote/configurator-14.json";
import cabinetTable581 from "@/entities/collection/__tests__/fixtures/remote/datatable-581.json";
import cabinetTable596 from "@/entities/collection/__tests__/fixtures/remote/datatable-596.json";
import { collectionSkuProfileSchema, type CollectionSkuProfile, type ProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import type { CabinetDimensions, CabinetEntry, ScopedValue, ValueTarget } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
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

/** Configurator 9: the colours of Mako name their material there. */
const configurator9Groups = configurator9.availableOptions as unknown as ConfiguratorAvailableOption[];
const configurator9Catalog: ConfiguratorGroupCatalog = {
  groups: configurator9Groups,
  groupsByName: Object.fromEntries(configurator9Groups.map((group) => [group.proxyName, group])),
};

/** Configurator 8, Class's own: its fronts, and the side and frame colours in sections of their own. */
const configurator8Groups = configurator8.availableOptions as unknown as ConfiguratorAvailableOption[];

export const CLASS = {
  profile: parseProfile(classProfileDocument),
  skuProfile: collectionSkuProfileSchema.parse(classSkuProfileDocument),
  configurator: {
    groups: configurator8Groups,
    groupsByName: Object.fromEntries(configurator8Groups.map((group) => [group.proxyName, group])),
  } satisfies ConfiguratorGroupCatalog,
};

const makoProfile = parseProfile(makoProfileDocument);

export const MAKO = {
  profile: makoProfile,
  skuProfile: collectionSkuProfileSchema.parse(makoSkuProfileDocument),
  configurator: configurator9Catalog,
  // Table 581: the cabinets the builder places, which a Mako cabinet's sizes are checked against.
  cabinetCatalog: buildCabinetCatalogFromMatrix(cabinetTable581 as ProductDatatable, makoProfile),
};

/** Configurator 14, Lame's own. */
const configurator14Groups = configurator14.availableOptions as unknown as ConfiguratorAvailableOption[];

const lameProfile = parseProfile(lameProfileDocument);

export const LAME = {
  profile: lameProfile,
  skuProfile: collectionSkuProfileSchema.parse(lameSkuProfileDocument),
  configurator: {
    groups: configurator14Groups,
    groupsByName: Object.fromEntries(configurator14Groups.map((group) => [group.proxyName, group])),
  },
  // Table 596: the cabinets the builder places, which a Lame cabinet's sizes are checked against.
  cabinetCatalog: buildCabinetCatalogFromMatrix(cabinetTable596 as ProductDatatable, lameProfile),
};

/** Configurator 4: the colours Urban Low Height shares with Urban Standard Height. */
const configurator4Groups = configurator4.availableOptions as unknown as ConfiguratorAvailableOption[];

export const URBAN_LOW_HEIGHT = {
  profile: parseProfile(urbanLowHeightProfileDocument),
  skuProfile: collectionSkuProfileSchema.parse(urbanLowHeightSkuProfileDocument),
  configurator: {
    groups: configurator4Groups,
    groupsByName: Object.fromEntries(configurator4Groups.map((group) => [group.proxyName, group])),
  },
};

/** Configurator 11, Urban Freestanding's own. */
const configurator11Groups = configurator11.availableOptions as unknown as ConfiguratorAvailableOption[];

export const URBAN_FREESTANDING = {
  profile: parseProfile(urbanFreestandingProfileDocument),
  skuProfile: collectionSkuProfileSchema.parse(urbanFreestandingSkuProfileDocument),
  configurator: {
    groups: configurator11Groups,
    groupsByName: Object.fromEntries(configurator11Groups.map((group) => [group.proxyName, group])),
  },
};

/** Configurator 13, Urban Duplex's own: its two panels are the two options of one cabinet colour group. */
const configurator13Groups = configurator13.availableOptions as unknown as ConfiguratorAvailableOption[];

export const URBAN_DUPLEX = {
  profile: parseProfile(urbanDuplexProfileDocument),
  skuProfile: collectionSkuProfileSchema.parse(urbanDuplexSkuProfileDocument),
  configurator: {
    groups: configurator13Groups,
    groupsByName: Object.fromEntries(configurator13Groups.map((group) => [group.proxyName, group])),
  },
};

type Collection = {
  profile: ProductProfile;
  skuProfile: CollectionSkuProfile;
  configurator?: ConfiguratorGroupCatalog;
  /** The collection's cabinet table as the builder holds it; the pricing input's own otherwise. */
  cabinetCatalog?: ConfiguratorCatalog;
};

export type CollectionCabinet = { stableKey: string; runtimeId: string; size: CabinetDimensions };

export const at = (target: ValueTarget, value: string): ScopedValue => ({ target, value });

/** A `PricingInput` of a collection priced from its SKU profile: no scene, no USH options. */
export const collectionPricingInput = (
  { profile, skuProfile, configurator, cabinetCatalog }: Collection,
  cabinets: readonly CollectionCabinet[],
  values: Record<string, ScopedValue[]>,
  overrides: Partial<PricingInput> = {},
): PricingInput =>
  pricingInput({
    skuBuilders: createSkuBuilders({ status: "collection", collectionProfile: skuProfile }),
    activeProfile: profile,
    configurator: configurator ?? null,
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
    ...(cabinetCatalog ? { cabinetCatalog } : {}),
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
      "Mako: SB 60 G57 + SC 60 G50, two drawers, gloss lacquer, silver handles, legs, Solid Surface vessel top with three holes, a two-column metal organizer",
    collection: MAKO,
    input: collectionPricingInput(
      MAKO,
      MAKO_CABINETS,
      {
        Drawers: [at(cabinetOf("mko-sb"), "2"), at(cabinetOf("mko-sc"), "2")],
        Handle: [at(cabinetOf("mko-sb"), "G57"), at(cabinetOf("mko-sc"), "G50")],
        HandleColor: [at(cabinetOf("mko-sb"), "Silver"), at(cabinetOf("mko-sc"), "Silver")],
        CabinetColor: [at(GLOBAL, "Grigio Argento 403 GL")],
        LegColor: [at(cabinetOf("mko-sb"), "Gold")],
        CountertopStyle: [at(COUNTERTOP, "vessel")],
        CountertopColor: [at(COUNTERTOP, "Matte White")],
        sinkType: [at({ scope: "basin", sinkBaseId: "mko-sb" }, "Iris")],
        FaucetHolesAmount: [at(COUNTERTOP, "3")],
      },
      {
        // SB 60 with two drawers, the Top one with a zone of -1…1: only ±2 are free, as 3D lays them out.
        organizersByCabinet: {
          "mko-sb": {
            status: "ok",
            value: {
              version: 1,
              Top: {
                style: "Metal",
                columns: [
                  { slot: -2, positions: [2] },
                  { slot: 2, positions: [] },
                ],
              },
            },
          },
        },
      },
    ),
  },
};

export const COLLECTION_PRICING_SCENARIO_IDS = Object.keys(
  COLLECTION_PRICING_SCENARIOS,
) as CollectionPricingScenarioId[];
