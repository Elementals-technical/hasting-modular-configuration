import type { RootState } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import type { CabinetDimensions, CabinetEntry, StableCabinetKey } from "@/entities/configuration";
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
  | "bookMatching";

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

export type ColorSkuMaps = {
  cabinetColorSkuByName: Map<string, string>;
  handleGrooveColorSkuByName: Map<string, string>;
  countertopColorSkuCandidatesByValue: CountertopColorSkuCandidatesByValue;
};

/** Everything the order lines are built from: A's collection data, C's state and the scene configs. */
export type PricingInput = {
  skuBuilders: SkuBuilders;
  activeProfile: ProductProfile | null;
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
