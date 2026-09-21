import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import type { PresetProduct } from "@/entities/product/types";
import type { NormalizedProductConfigSnapshot } from "@/shared/lib/normalizeProductConfigSnapshot";
import { buildColorSkuMaps } from "@/shared/lib/pricing/buildColorSkuMaps";
import type { PricingInput } from "@/shared/lib/pricing/types";
import { createSkuBuilders } from "@/shared/lib/sku";
import { ushSkuProfile } from "@/shared/lib/sku/__tests__/ushSkuProfileFixture";

/**
 * The reference USH orders the SKU, composition and price regression is fixed against (D03).
 *
 * Each scenario is a complete `PricingInput`, so `buildPricingLines` produces the same lines a
 * browser would for that configuration. The recorded price answers in `prices/` are keyed by the
 * SKUs these scenarios produce.
 */

export const cabinet = (
  id: string,
  overrides: Partial<NormalizedProductConfigSnapshot> = {},
): NormalizedProductConfigSnapshot => ({
  id,
  _productId: id,
  category: null,
  name: "Sink-Base",
  ProductType: "Sink-Base",
  productType: null,
  type: null,
  entityName: null,
  Width: 60,
  Height: 53,
  Depth: 50.5,
  Thickness: null,
  Drawers: "1D",
  Handle: "handle_urban_topcut",
  CabinetColor: null,
  CountertopColor: null,
  sinkType: null,
  ...overrides,
});

export const openShelf = (id: string, overrides: Partial<NormalizedProductConfigSnapshot> = {}) =>
  cabinet(id, { name: "Open-Shelf", ProductType: "Open-Shelf", Drawers: null, Handle: null, ...overrides });

const SINK_BASE_IDS = ["Sink-Base-aaaaaa", "Sink-Base-bbbbbb"];

export const pricingInput = (overrides: Partial<PricingInput> = {}): PricingInput => ({
  skuBuilders: createSkuBuilders({ status: "ready", profile: ushSkuProfile }),
  activeProfile: ushProfile,
  colorSkuMaps: buildColorSkuMaps(configurator4.availableOptions as unknown as ConfiguratorAvailableOption[]),
  countertopRules: [],
  cabinetCatalog: {
    typeCabinetRules: [{ code: "Sink-Base", widths: [60, 80], depths: [50.5], heights: [53], drawers: ["1", "2"] }],
  },
  shouldUsePresets: false,
  productIds: SINK_BASE_IDS,
  orderedProductIds: SINK_BASE_IDS,
  productsPresets: [],
  sceneConfigs: SINK_BASE_IDS.map((id) => cabinet(id)),
  cabinetEntries: [],
  dimensionsByCabinet: {},
  configurationValues: {},
  activeCabinetType: "Sink-Base",
  selectedDimensions: { width: 60, height: 53, depth: 50.5 },
  selectedProductConfig: null,
  placedDividers: [],
  placedCabinetStyles: {},
  cabinetColor: "Castagno chiaro 1C1",
  cabinetColorSku: "",
  handleGrooveColor: "",
  handleGrooveColorSku: "",
  countertopColor: "Cacao Orinoco FF MT",
  countertopColorSku: "",
  vesselColor: "",
  countertopThickness: "0.5",
  countertopStyle: "integrated",
  sinkType: "Top_Tekorlux_Rectangular",
  drawerPanelFluting: "",
  grainDirection: "",
  bookMatching: "",
  towelBarOption: "None",
  towelBarColor: "",
  faucetHolesAmount: "0",
  sidePanelsOption: "",
  sidePanelLeft: "none",
  sidePanelRight: "none",
  ...overrides,
});

const SHELF_ID = "Open-Shelf-cccccc";
const FULL_COMPOSITION_IDS = [...SINK_BASE_IDS, SHELF_ID];

/** Two identical sink bases, an open shelf, a countertop, both towel bars, both side panels, a divider. */
const fullComposition = (cabinetWidthCm: number): PricingInput =>
  pricingInput({
    productIds: FULL_COMPOSITION_IDS,
    orderedProductIds: FULL_COMPOSITION_IDS,
    sceneConfigs: [
      ...SINK_BASE_IDS.map((id) => cabinet(id, { Width: cabinetWidthCm })),
      openShelf(SHELF_ID, { Width: 40 }),
    ],
    towelBarOption: "Both",
    towelBarColor: "Carbone 43 MT",
    sidePanelsOption: "NoG",
    sidePanelLeft: "active",
    sidePanelRight: "active",
    placedDividers: [{ key: "divider-1", cabinetId: SINK_BASE_IDS[0], drawerType: "Bot", zone: "zone-1", type: "A" }],
  });

const PRESETS: PresetProduct[] = [
  {
    name: "Sink-Base",
    Width: 60,
    Height: 53,
    Depth: 50.5,
    Drawers: "1D",
    Handle: "handle_urban_topcut",
  },
  { name: "Open-Shelf", Width: 40, Height: 53, Depth: 50.5 },
];
const PRESET_IDS = ["preset-product-1", "preset-product-2"];
const ADDED_CABINET_ID = "Sink-Base-dddddd";

export type PricingScenarioId =
  | "custom-composition-60"
  | "custom-composition-80"
  | "custom-vessel"
  | "prebuilt-set-with-added-cabinet";

export const PRICING_SCENARIOS: Record<PricingScenarioId, { title: string; input: PricingInput }> = {
  "custom-composition-60": {
    title: "Custom: two identical 60 cm sink bases, open shelf, countertop, towel bars, side panels, divider",
    input: fullComposition(60),
  },
  "custom-composition-80": {
    title: "Custom: the same composition with 80 cm sink bases — a wider countertop",
    input: fullComposition(80),
  },
  "custom-vessel": {
    title: "Custom: vessel countertop over two sink bases with two faucet holes",
    input: pricingInput({
      countertopStyle: "vessel",
      countertopColorSku: "SSTKR",
      sinkType: "Vessel_UrbanModo",
      vesselColor: "Cacao Orinoco FF MT",
      faucetHolesAmount: "2",
    }),
  },
  "prebuilt-set-with-added-cabinet": {
    title: "Prebuilt: a set of two presets with one cabinet added in the sidebar",
    input: pricingInput({
      shouldUsePresets: true,
      productsPresets: PRESETS,
      productIds: [...PRESET_IDS, ADDED_CABINET_ID],
      orderedProductIds: [...PRESET_IDS, ADDED_CABINET_ID],
      sceneConfigs: [cabinet(ADDED_CABINET_ID)],
    }),
  },
};

export const PRICING_SCENARIO_IDS = Object.keys(PRICING_SCENARIOS) as PricingScenarioId[];
