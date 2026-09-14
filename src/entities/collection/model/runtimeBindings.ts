/**
 * Runtime bindings — how a semantic attribute value reaches the PlayCanvas scene.
 *
 * Types only. Each collection ships its own table in runtime-bindings.json next to its
 * manifest, read through parseRuntimeBindings.
 *
 * Missing translations are recorded as "unbound" with a reason instead of being guessed.
 */

export type SceneValue = string | number;

/** Keys and values sent to the scene in one call. */
export type ScenePatch = Record<string, SceneValue>;

/**
 * Semantic value as held in state. Structurally the same as AttributeValue in
 * entities/configuration; declared here so collection does not import configuration.
 */
export type SemanticValue = string | number | boolean | null;

/** Which scene products receive the patch. */
export type RuntimeTarget =
  /** The addressed cabinet, by its runtime id. */
  | { kind: "product" }
  /**
   * Every placed cabinet, without the countertop and add-ons: setConfigBatch(productIds, patch).
   * Pages read these ids through the misleadingly named getSelectedProducts.
   */
  | { kind: "cabinets" }
  /** Every product: setConfigBatch({}, patch). */
  | { kind: "all" }
  /** Every product of one runtime type: setConfigBatch({ productType }, patch). */
  | { kind: "productType"; productType: string };

/** Configurator flow; the same attribute may reach different products in each. */
export type RuntimeFlow = "prebuilt" | "custom";

/** A target that differs by flow, e.g. prebuilt paints every product, custom only the cabinets. */
export type FlowTargets = {
  kind: "byFlow";
  prebuilt: RuntimeTarget;
  custom: RuntimeTarget;
};

/** The value is sent under `sceneKey` unchanged. */
export type IdentityValues = {
  kind: "identity";
  sceneKey: string;
  /** Sent instead of an empty or null value. Absent: "" is sent as is, null is unknown. */
  emptyValue?: SceneValue;
  /** Values the scene knows under another name; every other value is sent as is. */
  overrides?: Record<string, SceneValue>;
};

/** Semantic value -> full scene patch, for renamed or multi-key values. Anything else is unknown. */
export type MappedValues = {
  kind: "map";
  patches: Record<string, ScenePatch>;
};

export type BoundRuntimeBinding = {
  attributeId: string;
  status: "bound";
  target: RuntimeTarget | FlowTargets;
  values: IdentityValues | MappedValues;
  /**
   * Phase the attribute is sent in: a set runs lowest first, e.g. drawers before the
   * handle and the handle before the height. Equal or missing orders keep C's order;
   * missing sorts after every declared order.
   */
  order?: number;
  /** Sent before the value, e.g. clearing the towel bar before setting another side. */
  resetBefore?: ScenePatch;
  /** Where the translation comes from or what to confirm. Not read by code. */
  note?: string;
};

export type UnboundRuntimeBinding = {
  attributeId: string;
  status: "unbound";
  /** Why there is no translation. Declared so it is not mistaken for a forgotten one. */
  reason: string;
};

export type RuntimeBinding = BoundRuntimeBinding | UnboundRuntimeBinding;

export type RuntimeBindingSet = {
  schemaVersion: number;
  collectionId: string;
  /**
   * CabinetType value -> runtime product type the scene places, e.g. "Side-Cabinet" is
   * placed as "Sink-Cabinet". Used by addProduct / setProductByParams, not setConfig.
   */
  productTypes: Record<string, string>;
  bindings: readonly RuntimeBinding[];
};
