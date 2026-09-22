import type { RootState } from "@/app/store";
import type { PricingGapGroup, ProductProfile, RuntimeBindingSet } from "@/entities/collection";
import type { CabinetDimensions, CabinetEntry, ScopedValue, StableCabinetKey } from "@/entities/configuration";
import type { CountertopMatrixRule } from "@/features/configurator-rule-core/countertop/types";
import type { NormalizedProductConfigSnapshot } from "@/shared/lib/normalizeProductConfigSnapshot";
import type { CountertopColorSkuCandidatesByValue, SkuBuilders } from "@/shared/lib/sku";

type ProductState = RootState["rootStateUI"]["product"];
type ProductOptions = ProductState["productOptions"];

export type PricingLineGroup =
  | "cabinet"
  | "openShelf"
  | "sideShelf"
  | "countertop"
  | "basin"
  | "faucetHoles"
  | "holeCut"
  | "vessel"
  | "towelBar"
  | "sidePanel"
  | "divider"
  | "bookMatching"
  /** Brackets of a thick countertop (collections priced from their SKU profile). */
  | "bracket";

/** One line of the order: what is priced and how many pieces of it. */
export type PricingLine = {
  /** Stable within a configuration, so a summary item finds the line it shows. */
  id: string;
  group: PricingLineGroup;
  sku: string;
  /** Pieces ordered. Identical price requests are merged; pieces never are. */
  quantity: number;
  /** Product the line belongs to (runtime id), when it belongs to one. */
  sourceId?: string;
  /** Actual countertop width the top line is priced for. */
  widthCm?: number;
};

/**
 * A part of the order the collection has not confirmed (D04): no SKU, no quantity rule or no
 * input for it. `blocksTotal` keeps the total incomplete while the order uses that part.
 */
export type PricingGap = {
  group: PricingGapGroup | "input";
  blocksTotal: boolean;
  owner: string;
  reason: string;
};

export type ColorSkuMaps = {
  cabinetColorSkuByName: Map<string, string>;
  handleGrooveColorSkuByName: Map<string, string>;
  countertopColorSkuCandidatesByValue: CountertopColorSkuCandidatesByValue;
};

/** Everything the order lines are built from: A's collection data, C's state and the scene configs. */
export type PricingInput = {
  skuBuilders: SkuBuilders;
  activeProfile: ProductProfile | null;
  /** The scene types of the collection, which name the placed products (a Mako sink base is a Mako-sink-cabinet). */
  runtimeBindings?: RuntimeBindingSet | null;
  colorSkuMaps: ColorSkuMaps;
  countertopRules: CountertopMatrixRule[];
  cabinetCatalog: ProductState["cabinetCatalog"];

  shouldUsePresets: boolean;
  productIds: readonly string[];
  /** Product ids in the scene's composition order. */
  orderedProductIds: readonly string[];
  productsPresets: ProductState["productsPresets"];
  sceneConfigs: readonly NormalizedProductConfigSnapshot[];
  cabinetEntries: readonly CabinetEntry[];
  dimensionsByCabinet: Readonly<Record<StableCabinetKey, CabinetDimensions>>;
  /** C's values by attribute and address; a collection priced from its SKU profile reads them. */
  configurationValues: Readonly<Record<string, readonly ScopedValue[]>>;
  activeCabinetType: ProductState["activeCabinetType"];
  selectedDimensions: ProductState["selectedDimensions"];
  selectedProductConfig: ProductState["selectedProductConfig"];
  placedDividers: ProductState["placedDividers"];
  placedCabinetStyles: ProductState["placedCabinetStyles"];

  cabinetColor: ProductOptions["CabinetColor"];
  cabinetColorSku: ProductOptions["CabinetColorSku"];
  handleGrooveColor: ProductOptions["HandleGrooveColor"];
  handleGrooveColorSku: ProductOptions["HandleGrooveColorSku"];
  countertopColor: ProductOptions["CountertopColor"];
  countertopColorSku: ProductOptions["CountertopColorSku"];
  vesselColor: ProductOptions["VesselColor"];
  countertopThickness: ProductOptions["Thickness"];
  countertopStyle: ProductOptions["CountertopStyle"];
  sinkType: ProductOptions["sinkType"];
  drawerPanelFluting: ProductOptions["DrawerPanelFluting"];
  grainDirection: ProductOptions["GrainDirection"];
  bookMatching: ProductOptions["BookMatching"];
  towelBarOption: ProductOptions["TowelBarOption"];
  towelBarColor: ProductOptions["TowelBarColor"];
  faucetHolesAmount: ProductOptions["FaucetHolesAmount"];
  sidePanelsOption: ProductOptions["SidePanels"];
  sidePanelLeft: ProductOptions["SidePanelLeft"];
  sidePanelRight: ProductOptions["SidePanelRight"];
};
