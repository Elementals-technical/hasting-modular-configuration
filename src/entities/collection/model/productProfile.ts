/**
 * ProductProfile — collection-owned product data that used to live as hardcoded
 * constants inside rules, reducers and page components.
 *
 * Ownership (CONTRACTS §2): C defines the semantic shape and the pure transformations;
 * A binds the sources (manifest / DataTable / packaged JSON) and calls them while loading.
 * Consumers only ever read a validated profile, so swapping the source in phase 2
 * (DataTable rows instead of local JSON) does not change the rule API.
 *
 * Explicitly NOT part of this profile:
 * - UI steps/sections and field layout — owned by B in ui.json
 * - PlayCanvas runtime bindings and scene value names — owned by I
 * - SKU tokens and pricing maps — owned by D
 */

/** Addressing target of an attribute value. Must stay in sync with ValueTarget in entities/configuration. */
export type AttributeScope = "global" | "cabinet" | "countertop" | "basin" | "drawer";

export const ATTRIBUTE_SCOPES: readonly AttributeScope[] = [
  "global",
  "cabinet",
  "countertop",
  "basin",
  "drawer",
];

/**
 * Product capabilities of a single option.
 * A capability replaces a name whitelist: any option that declares it gets the behaviour,
 * so a new option needs data only, never a code branch.
 */
export type OptionCapabilities = {
  /** Whether the groove-color attribute applies to this option. Replaces URBAN_HANDLES checks. */
  supportsGrooveColor?: boolean;
};

export type ProfileOption = {
  value: string;
  label: string;
  order: number;
  /** Product category of the option, e.g. "drawer-cabinet" / "open-cabinet" for CabinetType. */
  category?: string;
  /** Legacy runtime/table spellings that normalize to `value` (e.g. "1D" -> "1"). */
  aliases?: string[];
  capabilities?: OptionCapabilities;
  /** Legacy copy preserved for parity; presentation belongs to B. */
  legacyDescription?: string;
};

/**
 * When a change of the attribute waits for the user's confirmation before anything is
 * applied. The text shown for `reasonCode` lives in `messages`; B owns its display.
 */
export type AttributeConfirmation = {
  /** Ask only while at least one cabinet is placed: the change reaches all of them. */
  when: "cabinetsPlaced";
  reasonCode: string;
};

export type ProfileAttribute = {
  attributeId: string;
  scope: AttributeScope;
  /** Absent: the change is applied without asking. */
  confirmation?: AttributeConfirmation;
  /** Closed catalog. Absent when the options come from an external source. */
  options?: ProfileOption[];
  /** Reference to an external option source, resolved by A (e.g. "configurator:Handle Groove Color"). */
  optionsSource?: string;
  /** Value the attribute starts at. Not the same as a computed fallback. */
  initialValue?: string;
  /** Value used when nothing is selected and a concrete value is required. */
  defaultValue?: string;
  /**
   * Value substituted for computation while the user has not picked one yet.
   * Distinct from `initialValue`: USH starts Handle empty but computes heights as topcut.
   */
  effectiveFallbackValue?: string;
  /** Value meaning "cleared" for this attribute (e.g. HandleGrooveColor -> "None"). */
  resetValue?: string;
  /** Value meaning "not chosen" inside the catalog itself (e.g. SidePanels -> ""). */
  noneValue?: string;
};

/**
 * Mapping of the legacy cabinet-matrix columns onto generic relations.
 * The handle -> column map lives in data, so rule code never tests a handle id.
 */
export type CabinetMatrixLegacyAdapter = {
  tableId: number;
  columns: {
    cabinetType: string;
    drawers: string;
    handlesAllowed: string;
    supportsHeight: string;
    /** handleId -> column name holding "drawers:height|drawers:height". */
    forcedHeightByHandle: Record<string, string>;
    /** handleId -> column name holding the drawers values that allow this handle. */
    requiresDrawersByHandle: Record<string, string>;
    /**
     * One column of forced heights for every handle: "drawers:height" applies whatever the
     * handle, "handleId/drawers:height" to that handle only ("1:26|2:52"). A table in this
     * shape needs no column per handle; the per-handle maps above stay for the Urban table.
     */
    forcedHeight?: string;
    /** One column of the drawers each handle allows: "handleId:drawers" ("handle_urban_botcut:2"). */
    handleDrawerConfigs?: string;
  };
};

/**
 * Drawer option values that may be placed together; a style outside the group of the
 * placed cabinets is restricted. Same shape as `compositionStyleGroups` of Mako/Class.
 */
export type DrawerStyleGroups = string[][];

export type FlutingRuleData = {
  /** Cabinet material spellings that allow fluting, compared trimmed and upper-cased. */
  eligibleMaterialAliases: string[];
  /** Parts that never take fluting, e.g. "SIDE_PANEL". */
  forbiddenTargetParts: string[];
};

export type GrainDirectionRuleData = {
  eligibleMaterials: string[];
  excludedFinishesByMaterial: Record<string, string[]>;
  /** Readable list of the excluded finishes per material, shown in the reason text. */
  excludedFinishLabelsByMaterial?: Record<string, string>;
};

export type BookMatchingRuleData = {
  horizontalMinimumAdjacentDrawerCabinets: number;
  /** Drawers option values that allow vertical book matching. */
  verticalAllowedDrawerStyles: string[];
  drawerCabinetAliases: string[];
  openCabinetAliases: string[];
};

/**
 * A change whose outcome the product has not decided (CONTRACTS §8: valid / invalid /
 * undetermined). The command blocks it with `product.missingData` and changes nothing,
 * rather than letting it through as allowed or inventing a rule.
 */
export type UndeterminedRule = {
  /** Stable id, named in the reason: "MAKO-LEG-002". */
  ruleId: string;
  attributeId: string;
  /** Only these values; any value but the attribute's clearing one when absent. */
  values?: string[];
  /** Only on a cabinet whose own values are these, e.g. `{ "Drawers": ["1"] }`. */
  whenCabinet?: Record<string, string[]>;
  /** The open question in the product documents: "Q-MAKO-002". */
  source: string;
};

export type SidePanelAvailabilityRow = {
  height: string;
  handleType: string;
  cabinetType: string;
  /** SidePanels option values allowed for this row. */
  allowed: string[];
};

export type SidePanelsRuleData = {
  heightTokenByCm: Record<string, string>;
  blockedCabinetTypes: string[];
  /**
   * Cabinet group ("SBSC", "OS", "OSS") -> names and codes of its cabinets. A name with a
   * hyphen may sit inside a runtime id; a code without one must match the whole id.
   */
  cabinetGroups: Record<string, string[]>;
  /** Drawer group of the availability table ("1D", "2D") -> drawers values that belong to it. */
  drawersByHandleType: Record<string, string[]>;
  /**
   * Handle value -> side panel grooves to prefer, in order, when the current one is no longer
   * allowed. A handle without an entry falls back to the first allowed groove.
   */
  groovePriorityByHandle?: Record<string, string[]>;
  exactBlockedCabinetLengthCm: number;
  countertopLengthIncrementCm: number;
  defaultQuantityUnlessHeightTypeLow: number;
  availability: SidePanelAvailabilityRow[];
};

export type SyntesiFinishTransform = {
  finish: string;
  sourceFinish: string;
  label: string;
  value: string;
  runtimeValue: string;
};

export type SyntesiRuleData = {
  material: string;
  materialSkuToken: string;
  maxCabinetCount: number;
  allowsSidePanels: boolean;
  finishTransforms: SyntesiFinishTransform[];
  sourceMaterialTokens: string[];
};

export type CountertopFallbacksRuleData = {
  restrictedIntegratedDepthsCm: number[];
  restrictedIntegratedMaterialTokens: string[];
  restrictedIntegratedBasinKeys: string[];
  excludedMaterialFilterTokens: string[];
  /** Set while it is unconfirmed whether these facts duplicate the countertop table. */
  needsConfirmation?: boolean;
};

export type MaterialDisplayGroup = {
  value: string;
  label: string;
  children: string[];
  aliases: string[];
};

export type MaterialNormalizationRuleData = {
  /** Normalized material token -> tokens that mean the same material. */
  aliases: Record<string, string[]>;
  displayHierarchy?: MaterialDisplayGroup[];
  vesselCompatibleCountertopMaterialTokens?: string[];
};

export type VesselFinishPreference = {
  materialTokens: string[];
  colorCodes: string[];
};

export type VesselCompatibilityRuleData = {
  hiddenStyles: string[];
  /** Vessel style (or style prefix) -> countertop material tokens it accepts. */
  allowedMaterialsByStyle: Record<string, string[]>;
  /** Vessel style -> material token -> colour codes allowed inside that material. */
  allowedColorCodesByStyle: Record<string, Record<string, string[]>>;
  /** Vessel style -> material token -> colour codes excluded inside that material. */
  unavailableColorCodesByStyle: Record<string, Record<string, string[]>>;
  defaultFinishByStyle: Record<string, VesselFinishPreference>;
};

/**
 * How a cabinet colour of the configurator is read into the material and finish the fluting
 * and grain rules check. The configurator carries neither as a field of its own.
 */
export type CabinetColorTraitsRuleData = {
  /** Variant SKU, compared trimmed and upper-cased -> material token ("ESS" -> "Essenze"). */
  materialBySku: Record<string, string>;
  /** Material tokens preferred among the option's own material labels when the SKU is not mapped. */
  knownMaterials: string[];
  /** Finish codes found as whole words in the colour name, its label or its option name. */
  finishCodes: string[];
};

/**
 * Rule parameters: the algorithms stay in code, their lists, limits and exclusions live here.
 *
 * Every section except the cabinet matrix adapter is optional. An absent section means the
 * collection does not offer the feature (fluting, grain direction, book matching, side
 * panels) or has no such restriction (drawer style groups, Syntesi, countertop fallbacks,
 * vessel compatibility, material aliases). USH values are never substituted.
 */
export type ProfileRuleData = {
  cabinetMatrixLegacyAdapter: CabinetMatrixLegacyAdapter;
  drawerStyleGroups?: DrawerStyleGroups;
  /** Changes the product has no rule for yet (CONTRACTS §8); the command holds them back. */
  undeterminedRules?: UndeterminedRule[];
  fluting?: FlutingRuleData;
  grainDirection?: GrainDirectionRuleData;
  bookMatching?: BookMatchingRuleData;
  sidePanels?: SidePanelsRuleData;
  syntesi?: SyntesiRuleData;
  countertopFallbacks?: CountertopFallbacksRuleData;
  materialNormalization?: MaterialNormalizationRuleData;
  vesselCompatibility?: VesselCompatibilityRuleData;
  cabinetColorTraits?: CabinetColorTraitsRuleData;
};

/** Stable reason codes -> legacy English fallback. B owns display and translation. */
export type ProfileMessages = Record<string, string>;

export type ProfileSourceRefs = {
  configuratorId: number;
  countertopMatrixTableId: number;
  cabinetMatrixTableId: number;
};

export type ProductProfile = {
  schemaVersion: number;
  collectionId: string;
  label?: string;
  sourceRefs: ProfileSourceRefs;
  /** Initial values that are not expressed as a catalog attribute. */
  defaults: Record<string, string>;
  attributes: ProfileAttribute[];
  ruleData: ProfileRuleData;
  messages: ProfileMessages;
};
