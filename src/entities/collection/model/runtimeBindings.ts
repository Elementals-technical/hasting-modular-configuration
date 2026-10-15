/**
 * Runtime bindings — how a semantic attribute value reaches the PlayCanvas scene.
 *
 * Types only. Each collection ships its own table in runtime-bindings.json next to its
 * manifest, read through parseRuntimeBindings.
 *
 * Missing translations are recorded as "unbound" with a reason instead of being guessed.
 * A value the scene never shows is "state-only": it is recorded without a scene call.
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
  /**
   * Values without a delivered scene asset or contract, each with its reason: catalog values (a
   * wood whose material is missing), or the scene's own value read back in their place. Never
   * sent: a product is placed without them, and a command for one is unsupported.
   */
  unboundValues?: Record<string, string>;
};

/**
 * One more place a value goes to, after the binding's own: under another scene key, to other
 * products, or both. The Urban Duplex lateral panel colour is also the colour of the handle
 * grooves, and of an open side shelf, whose only colour key is the cabinet's.
 */
export type AlsoDelivery = {
  target: RuntimeTarget;
  sceneKey: string;
};

export type BoundRuntimeBinding = {
  attributeId: string;
  status: "bound";
  target: RuntimeTarget | FlowTargets;
  values: IdentityValues | MappedValues;
  /**
   * More places the same value goes to, in this order. Identity values only. A product being
   * placed takes one addressed to a product type only when it is of that type.
   */
  also?: readonly AlsoDelivery[];
  /**
   * A product placed later is given the value with its config. The scene keeps a value per
   * product, so without this a new product starts from the scene's own default: it is placed
   * with the configuration's value, or the collection's starting value while none was chosen.
   */
  placedWithNewProducts?: boolean;
  /**
   * The scene keeps the value on each product, so a change that names one cabinet and asks for
   * that cabinet alone (`onlyThisCabinet`) reaches that product only: the side of the lateral
   * panel of Urban Duplex, which a field sets for all cabinets and the cabinet's menu for one.
   * Without it a value bound to "all" reaches every product, whatever cabinet a change names.
   */
  perProduct?: boolean;
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

/**
 * A value the scene has no key for and never shows, e.g. the faucet holes count. The
 * command records it without a scene call. Unlike "unbound", this is a decision that
 * nothing needs to be sent, not a translation still missing.
 */
export type StateOnlyRuntimeBinding = {
  attributeId: string;
  status: "state-only";
  /** Why the scene does not need the value. */
  reason: string;
};

export type RuntimeBinding = BoundRuntimeBinding | UnboundRuntimeBinding | StateOnlyRuntimeBinding;

/**
 * A scene product that keeps a height of its own beside the taller products of the composition
 * (Urban Freestanding: the 1 Drawer Short Side Cabinet, sent `Drawers: "1D"`).
 * Whatever height the composition is sent, the scene gets this product's own, by its handle: the
 * scene bridge corrects it after every command that carries a height or a handle, and places it
 * with it. Built from the cabinet catalog (buildSteppedSceneProducts), so the heights are the table's.
 */
export type SteppedSceneProduct = {
  /** Scene product type, as `productTypes` names it. */
  productType: string;
  /** Scene config values that make the product stepped. */
  match: ScenePatch;
  /** Handle value (as the scene holds it) -> the scene height the product takes with it. */
  heightByHandle: Record<string, number>;
};

export type RuntimeBindingSet = {
  schemaVersion: number;
  collectionId: string;
  /**
   * Opt-in: before placement/restore, reject a product config holding a value the collection cannot
   * translate (an unknown value, a key without a binding) instead of sending it as it is. A pending
   * (unbound) value does not stop placement: the product is placed without it.
   */
  strictProductConfig?: boolean;
  /**
   * CabinetType value -> runtime product type the scene places, e.g. "Side-Cabinet" is
   * placed as "Sink-Cabinet". Used by addProduct / setProductByParams, not setConfig.
   */
  productTypes: Record<string, string>;
  /**
   * CabinetType value -> why the scene cannot place it yet, e.g. a module the scene has no
   * product for. Declared so it is not mistaken for a forgotten product type; the builder
   * temporarily hides it until the scene has its product.
   */
  unplacedProductTypes?: Record<string, string>;
  bindings: readonly RuntimeBinding[];
};
