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
  };
};

/**
 * Rule parameters. Only the P0 slice is typed here; later waves (grain, fluting,
 * countertop, side panels, dividers) add their own fields as they are migrated.
 */
export type ProfileRuleData = {
  cabinetMatrixLegacyAdapter: CabinetMatrixLegacyAdapter;
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
