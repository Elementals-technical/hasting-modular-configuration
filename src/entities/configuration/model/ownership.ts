import type { Scope } from "./types";

/**
 * Registry of value owners — the C01 deliverable.
 *
 * For every configuration value it records one owner, one scope and one persistence
 * channel, so "two independently mutable copies" becomes a checkable property instead
 * of a review comment. `ownership.test.ts` fails when a field is added to the product
 * slice without an entry here.
 *
 * Verified against the code at the audited head: the product slice `productOptions`
 * block, `ConfigurationUiState` in buildConfigurationMetadata, and the PlayCanvas
 * re-apply lists in restoreSnapshot. Entries owned by `runtime` were confirmed against
 * runtime-bindings.json: CabinetType is set by placing a product, and SidePanelLeft/Right
 * are per-side statuses sidePanels.ts records after the scene call.
 */

/** Who may write the value. */
export type ValueOwner =
  /** A reducer in the product slice is the single writer. */
  | "redux"
  /** The scene is authoritative; Redux mirrors what it reports. */
  | "runtime"
  /** Computed from other values; never written directly. */
  | "derived"
  /** Belongs to the pricing block (D); state keeps it only to pass it through. */
  | "pricing";

/** Where the value survives Save/Share and restore. */
export type PersistedIn =
  /** metadata.uiState in buildConfigurationMetadata. */
  | "uiState"
  /** Only inside the per-product PlayCanvas config stored under `configuration`. */
  | "productConfig"
  | "both"
  /** Not persisted at all — lost on Save. */
  | "none";

export type AttributeOwnership = {
  scope: Scope;
  owner: ValueOwner;
  persistedIn: PersistedIn;
  /** Where the value physically lives today, for migration bookkeeping. */
  stateField: string;
  /** Whether the USH ProductProfile declares a matching attribute catalog. */
  hasProfileAttribute: boolean;
  note?: string;
};

const productOption = (field: string, rest: Omit<AttributeOwnership, "stateField">): AttributeOwnership => ({
  ...rest,
  stateField: `product.productOptions.${field}`,
});

/**
 * Keyed by attributeId. Keys that match a `productOptions` field are covered by the
 * guard test; `CabinetType` and `Drawers` are extra because they live elsewhere.
 */
export const ATTRIBUTE_OWNERSHIP: Record<string, AttributeOwnership> = {
  CabinetColor: productOption("CabinetColor", {
    scope: "global",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
    note: "declared with optionsSource: the options come from the configurator; SKU, material and finish are still written by the pages",
  }),
  CabinetColorSku: productOption("CabinetColorSku", {
    scope: "global",
    owner: "pricing",
    persistedIn: "none",
    hasProfileAttribute: false,
    note: "D owns SKU mapping; not restored from Save",
  }),
  CabinetColorMaterial: productOption("CabinetColorMaterial", {
    scope: "global",
    owner: "redux",
    persistedIn: "none",
    hasProfileAttribute: false,
    note: "drives grain/fluting availability but is not saved — re-derived from CabinetColor on restore; the command service derives it from ruleData.cabinetColorTraits when it records CabinetColor, the colour pages still write it until B06",
  }),
  CabinetColorFinish: productOption("CabinetColorFinish", {
    scope: "global",
    owner: "redux",
    persistedIn: "none",
    hasProfileAttribute: false,
    note: "same as CabinetColorMaterial",
  }),
  sinkType: productOption("sinkType", {
    scope: "basin",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
  }),
  CountertopColor: productOption("CountertopColor", {
    scope: "countertop",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
    note: "declared with optionsSource: the options come from the configurator",
  }),
  CountertopColorSku: productOption("CountertopColorSku", {
    scope: "countertop",
    owner: "pricing",
    persistedIn: "uiState",
    hasProfileAttribute: false,
  }),
  VesselColor: productOption("VesselColor", {
    scope: "basin",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
    note: "declared with optionsSource (configurator Vessels); restore re-applies it to Sink-Base products only",
  }),
  HandleGrooveColor: productOption("HandleGrooveColor", {
    scope: "cabinet",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
    note: "applicability is decided by the Handle capability supportsGrooveColor",
  }),
  HandleGrooveColorSku: productOption("HandleGrooveColorSku", {
    scope: "cabinet",
    owner: "pricing",
    persistedIn: "none",
    hasProfileAttribute: false,
  }),
  Handle: productOption("Handle", {
    scope: "cabinet",
    owner: "redux",
    persistedIn: "productConfig",
    hasProfileAttribute: true,
    note: "absent from ConfigurationUiState — survives Save only because it is inside each product config",
  }),
  Thickness: productOption("Thickness", {
    scope: "countertop",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
  }),
  DrawerPanelFluting: productOption("DrawerPanelFluting", {
    scope: "cabinet",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
  }),
  GrainDirection: productOption("GrainDirection", {
    scope: "cabinet",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
  }),
  BookMatching: productOption("BookMatching", {
    scope: "global",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
  }),
  CountertopStyle: productOption("CountertopStyle", {
    scope: "countertop",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
  }),
  SidePanels: productOption("SidePanels", {
    scope: "global",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
  }),
  SidePanelLeft: productOption("SidePanelLeft", {
    scope: "global",
    owner: "runtime",
    persistedIn: "uiState",
    hasProfileAttribute: false,
    note: "per-side status mirrored from the scene; confirm the writer with I",
  }),
  SidePanelRight: productOption("SidePanelRight", {
    scope: "global",
    owner: "runtime",
    persistedIn: "uiState",
    hasProfileAttribute: false,
    note: "per-side status mirrored from the scene; confirm the writer with I",
  }),
  LedOption: productOption("LedOption", {
    scope: "global",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
  }),
  DividersOption: productOption("DividersOption", {
    scope: "global",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
  }),
  DividersStyle: productOption("DividersStyle", {
    scope: "global",
    owner: "redux",
    persistedIn: "both",
    hasProfileAttribute: true,
    note: "the style the picker places next, one for the whole configuration; the dividers already placed carry their own type per drawer in placedDividers. selectedDividerType is derived from it and must never be written independently",
  }),
  TowelBarOption: productOption("TowelBarOption", {
    scope: "global",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
  }),
  TowelBarColor: productOption("TowelBarColor", {
    scope: "global",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
    note: "declared with optionsSource: the options come from the configurator",
  }),
  FaucetHolesAmount: productOption("FaucetHolesAmount", {
    scope: "countertop",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: true,
  }),
  FaucetHolesSpacing: productOption("FaucetHolesSpacing", {
    scope: "countertop",
    owner: "redux",
    persistedIn: "uiState",
    hasProfileAttribute: false,
    note: "carried through from links saved before the migration: no step offers it and no collection declares a catalog for it, so it is only recorded and saved again",
  }),

  // Values addressed per product that do not live in `productOptions`.
  CabinetType: {
    scope: "cabinet",
    owner: "runtime",
    persistedIn: "productConfig",
    stateField: "product.activeCabinetType (builder selection) / scene product name (per cabinet)",
    hasProfileAttribute: true,
    note: "the per-cabinet type is encoded in the runtime product id; activeCabinetType is only the builder's current pick",
  },
  Drawers: {
    scope: "cabinet",
    owner: "redux",
    persistedIn: "productConfig",
    stateField: "product.placedCabinetStyles[cabinetId]",
    hasProfileAttribute: true,
    note: "selectedProductConfig.Drawers mirrors the active cabinet only; placedCabinetStyles is the per-cabinet record",
  },
};

/** Attribute ids that are currently stored in the typed product slice. */
export const CORE_ATTRIBUTE_IDS: readonly string[] = Object.keys(ATTRIBUTE_OWNERSHIP);

export const getAttributeOwnership = (attributeId: string): AttributeOwnership | null =>
  ATTRIBUTE_OWNERSHIP[attributeId] ?? null;

export const getAttributeScope = (attributeId: string): Scope | null =>
  getAttributeOwnership(attributeId)?.scope ?? null;

/** Values that are silently dropped by the current Save format. Input for C07. */
export const getUnpersistedAttributeIds = (): string[] =>
  Object.entries(ATTRIBUTE_OWNERSHIP)
    .filter(([, ownership]) => ownership.persistedIn === "none")
    .map(([attributeId]) => attributeId);
