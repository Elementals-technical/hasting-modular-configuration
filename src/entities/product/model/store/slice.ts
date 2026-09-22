import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  applyConfiguratorRules,
  type Intent,
  type OptionState,
  type Selection,
} from "@/features/configurator-rule-core/cabinetBuilder";
import { resolveForcedHeightForHandle } from "@/features/configurator-rule-core/cabinetBuilder/lib/handleForcedHeight";
import { resolveHandleAfterRules } from "@/features/configurator-rule-core/cabinetBuilder/lib/resolveHandleAfterRules";
import { getDividerTypeFromOptionTitle } from "@/features/dividers/model/normalize";
import type { DividerType } from "@/features/dividers/model/types";
import { hasCapability, normalizeOptionValue, type ProductProfile } from "@/entities/collection";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import type { PresetProduct } from "../../types";

type DimensionOption = {
  name: number | string;
  value: number | string;
  disabled?: boolean;
  reason?: string;
};

type DimensionOptionGroup = {
  width: DimensionOption[];
  height: DimensionOption[];
  depth: DimensionOption[];
  drawers: DimensionOption[];
  handles: DimensionOption[];
};

export type PlacedDivider = {
  key: string;
  cabinetId: string;
  drawerType: "Top" | "TopFull" | "Bot";
  zone: string;
  type: "A" | "B" | "C";
};

type ProductState = {
  productIds: string[];
  activeCabinetType: string | null;
  activeDrawerProduct: string;
  selectedProductConfig: ProductConfig | null;
  selectedDimensions: ProductDimensions;
  heightLocked: number | null;
  hasBootstrappedCabinetBuilder: boolean;
  dimensionOptions: DimensionOptionGroup;
  cabinetCatalog: ConfiguratorCatalog;
  /**
   * Product data of the active collection, supplied by A.
   *
   * Transitional home: rule evaluation still runs inside the reducers below, and a
   * `createSlice` reducer cannot read another slice, so the profile lives next to
   * `cabinetCatalog`. Consumers must read it through `getActiveProductProfile` in
   * entities/configuration so this location stays replaceable when C06 moves rule
   * evaluation into the command layer.
   */
  activeProfile: ProductProfile | null;
  placedDividers: PlacedDivider[];
  /**
   * SSOT for the currently selected divider type. Derived from
   * `productOptions.DividersStyle` ("Option A|B|C") in the reducers that write
   * that label — consumers must read this field (or its selector) instead of
   * re-parsing the UI label.
   */
  selectedDividerType: DividerType | null;
  /** Maps productId → raw drawer value ("1", "2", "1+inner"). Only set for non-open cabinets. */
  placedCabinetStyles: Record<string, string>;
  productOptions: {
    CabinetColor: string;
    CabinetColorSku: string;
    CabinetColorMaterial: string;
    CabinetColorFinish: string;
    sinkType: string;
    CountertopColor: string;
    CountertopColorSku: string;
    VesselColor: string;
    HandleGrooveColor: string;
    HandleGrooveColorSku: string;
    Handle: HandleOption;
    Thickness: string;
    DrawerPanelFluting: string;
    GrainDirection: string;
    BookMatching: string;
    CountertopStyle: string;
    SidePanels: string;
    SidePanelLeft: "active" | "none" | "auto-removed";
    SidePanelRight: "active" | "none" | "auto-removed";
    LedOption: string;
    DividersOption: string;
    DividersStyle: string;
    TowelBarOption: string;
    TowelBarColor: string;
    FaucetHolesAmount: string;
    FaucetHolesSpacing: string;
  };

  productsPresets: PresetProduct[];
  selectedSceneProduct: string;
  isDrawerOpen: boolean;
  /**
   * Monotonic counter bumped whenever the cabinet composition order changes
   * (add / remove / swap / insert / restore). Consumers that read PlayCanvas
   * edge state imperatively depend on this to re-read AFTER the scene settles,
   * instead of relying on render-time reads that can be stale.
   */
  compositionVersion: number;
};

type ProductDimensions = {
  width: number | null;
  height: number | null;
  depth: number | null;
};

type ProductConfig = {
  [key: string]: unknown;
} & Partial<addProductConfigI>;

/**
 * Handle option id. Deliberately not a closed union: the catalog comes from the active
 * ProductProfile, so a collection with different handles needs no type change.
 * Membership is validated against the profile catalog, so an arbitrary unknown string
 * still never becomes an allowed option.
 */
export type HandleOption = string;

const DEFAULT_DIMENSIONS: ProductDimensions = {
  width: null,
  height: null,
  depth: null,
};

const mapOptionState = <T extends string | number>(option: OptionState<T>): DimensionOption => ({
  name: option.label ?? option.value,
  value: option.value,
  disabled: !option.enabled,
  reason: option.reason,
});

/**
 * Legacy drawer spellings kept only for the window where no profile is loaded yet.
 * The authoritative aliases live in the Drawers catalog of the active profile.
 */
const LEGACY_DRAWER_ALIASES: Record<string, string> = {
  "1D": "1",
  "2D": "2",
  "1DWID": "1+inner",
  "1": "1",
  "2": "2",
  "1+inner": "1+inner",
};

const mapDrawerConfigToRule = (value: unknown, profile: ProductProfile | null): string | null => {
  if (typeof value !== "string") return null;

  const fromProfile = normalizeOptionValue(profile, "Drawers", value);
  if (fromProfile) return fromProfile;

  if (profile) return null;

  return LEGACY_DRAWER_ALIASES[value.trim()] ?? null;
};

const mapHandleConfigToRule = (value: unknown, profile: ProductProfile | null): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized) return null;

  // Without a profile there is no catalog to check against, so keep the legacy
  // pass-through; with one, an unknown id is not an option.
  if (!profile) return normalized;

  return normalizeOptionValue(profile, "Handle", normalized);
};

const toSelection = (state: ProductState): Selection => ({
  cabinetType: state.activeCabinetType,
  width: state.selectedDimensions.width ?? 0,
  depth: state.selectedDimensions.depth ?? 0,
  height: state.selectedDimensions.height ?? 0,
  drawers: mapDrawerConfigToRule(state.selectedProductConfig?.Drawers, state.activeProfile),
  handle: mapHandleConfigToRule(state.selectedProductConfig?.Handle, state.activeProfile),
});

const applyRulesToState = (state: ProductState, intent?: Intent) => {
  if (!state.activeCabinetType) {
    state.dimensionOptions = {
      width: [],
      depth: [],
      height: [],
      drawers: [],
      handles: [],
    };
    state.heightLocked = null;
    return;
  }

  const ruleResult = applyConfiguratorRules(
    toSelection(state),
    intent,
    { selectedProductIds: state.productIds },
    state.cabinetCatalog,
    state.activeProfile,
  );

  state.dimensionOptions = {
    width: ruleResult.availableOptions.width.map(mapOptionState),
    depth: ruleResult.availableOptions.depth.map(mapOptionState),
    height: ruleResult.availableOptions.height.map(mapOptionState),
    drawers: ruleResult.availableOptions.drawers.map(mapOptionState),
    handles: ruleResult.availableOptions.handles.map(mapOptionState),
  };

  state.selectedDimensions = {
    width: ruleResult.nextSelection.width,
    height: ruleResult.nextSelection.height,
    depth: ruleResult.nextSelection.depth,
  };
  state.heightLocked = ruleResult.heightLocked;

  const currentHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle, state.activeProfile);

  // Same resolution as the CabinetBuilder page — one implementation, so the two cannot drift.
  const nextHandle = resolveHandleAfterRules({
    currentHandle,
    handles: ruleResult.availableOptions.handles,
    heightLocked: ruleResult.heightLocked,
  });

  if (nextHandle !== currentHandle && state.selectedProductConfig) {
    state.selectedProductConfig = {
      ...state.selectedProductConfig,
      Handle: nextHandle ?? undefined,
    };
  }
};

/**
 * Every product option at "not chosen". Collection-specific starting values come from
 * `profile.defaults`, not from literals here — a collection without a value for an
 * attribute starts empty rather than inheriting the USH one.
 */
const EMPTY_PRODUCT_OPTIONS: ProductState["productOptions"] = {
  CabinetColor: "",
  CabinetColorSku: "",
  CabinetColorMaterial: "",
  CabinetColorFinish: "",
  sinkType: "",
  CountertopColor: "",
  CountertopColorSku: "",
  VesselColor: "",
  HandleGrooveColor: "",
  HandleGrooveColorSku: "",
  Handle: "",
  Thickness: "",
  DrawerPanelFluting: "",
  GrainDirection: "",
  BookMatching: "",
  CountertopStyle: "",
  SidePanels: "",
  SidePanelLeft: "none",
  SidePanelRight: "none",
  LedOption: "",
  DividersOption: "",
  DividersStyle: "",
  TowelBarOption: "",
  TowelBarColor: "",
  FaucetHolesAmount: "",
  FaucetHolesSpacing: "",
};

/**
 * Starting values declared by the active collection.
 *
 * Only keys that exist in the typed options are applied, so a profile cannot invent a
 * field here; unknown attribute ids belong in the configuration slice instead.
 */
const applyProfileDefaults = (profile: ProductProfile | null): Partial<ProductState["productOptions"]> => {
  if (!profile) return {};

  const known = Object.keys(EMPTY_PRODUCT_OPTIONS);

  return Object.fromEntries(
    Object.entries(profile.defaults).filter(([attributeId]) => known.includes(attributeId)),
  ) as Partial<ProductState["productOptions"]>;
};

const createInitialState = (profile: ProductProfile | null = null): ProductState => {
  const baseState: ProductState = {
    productIds: [],
    activeCabinetType: null,
    activeDrawerProduct: "",
    selectedProductConfig: null,
    selectedDimensions: DEFAULT_DIMENSIONS,
    heightLocked: null,

    hasBootstrappedCabinetBuilder: false,

    dimensionOptions: {
      width: [],
      height: [],
      depth: [],
      drawers: [],
      handles: [],
    },
    cabinetCatalog: { typeCabinetRules: [] },
    activeProfile: profile,
    placedDividers: [],
    selectedDividerType: null,
    placedCabinetStyles: {},
    productOptions: { ...EMPTY_PRODUCT_OPTIONS, ...applyProfileDefaults(profile) },

    productsPresets: [],
    selectedSceneProduct: "",
    isDrawerOpen: false,
    compositionVersion: 0,
  };

  applyRulesToState(baseState);

  return baseState;
};

const initialState: ProductState = createInitialState();

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    addProductId(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!id) return;
      const next = [...state.productIds.filter((pid) => pid !== id), id];
      state.productIds = next;
      state.compositionVersion += 1;
      applyRulesToState(state);
    },
    insertProductIdRelative(state, action: PayloadAction<{ id: string; prevId: string; side: "left" | "right" }>) {
      const { id, prevId, side } = action.payload;
      if (!id) return;

      const next = state.productIds.filter((pid) => pid !== id);
      const prevIndex = next.indexOf(prevId);

      if (prevIndex === -1) {
        next.push(id);
        state.productIds = next;
        state.compositionVersion += 1;
        return;
      }

      const insertIndex = side === "left" ? prevIndex : prevIndex + 1;
      next.splice(insertIndex, 0, id);
      state.productIds = next;
      state.compositionVersion += 1;
      applyRulesToState(state);
    },
    removeProductId(state, action: PayloadAction<string>) {
      const lastIndex = state.productIds.lastIndexOf(action.payload);

      if (lastIndex !== -1) {
        state.productIds.splice(lastIndex, 1);
      }

      delete state.placedCabinetStyles[action.payload];
      state.placedDividers = state.placedDividers.filter((divider) => divider.cabinetId !== action.payload);
      state.compositionVersion += 1;
      applyRulesToState(state);
    },
    /**
     * Records the composition the scene holds after a composition command (C06): the products in
     * order and the drawer style of each new one. Styles and dividers of products that left the
     * composition go with them, and the rules run once for the whole change.
     */
    recordComposition(
      state,
      action: PayloadAction<{ productIds: string[]; placedCabinetStyles?: Record<string, string> }>,
    ) {
      const { productIds, placedCabinetStyles = {} } = action.payload;
      const placed = new Set(productIds);

      state.productIds = [...productIds];
      state.placedCabinetStyles = Object.fromEntries(
        Object.entries({ ...state.placedCabinetStyles, ...placedCabinetStyles }).filter(([id]) => placed.has(id)),
      );
      state.placedDividers = state.placedDividers.filter((divider) => placed.has(divider.cabinetId));
      state.compositionVersion += 1;
      applyRulesToState(state);
    },
    swapProductIds(state, action: PayloadAction<{ idA: string; idB: string }>) {
      const { idA, idB } = action.payload;
      const indexA = state.productIds.indexOf(idA);
      const indexB = state.productIds.indexOf(idB);

      if (indexA === -1 || indexB === -1 || indexA === indexB) return;

      const next = [...state.productIds];
      next[indexA] = idB;
      next[indexB] = idA;
      state.productIds = next;
      state.compositionVersion += 1;
      applyRulesToState(state);
    },
    reset(state) {
      return {
        ...createInitialState(state.activeProfile),
        cabinetCatalog: state.cabinetCatalog,
      };
    },
    resetProducts(state) {
      state.productIds = [];
      state.placedCabinetStyles = {};
      state.placedDividers = [];
      state.compositionVersion += 1;
      applyRulesToState(state);
    },
    resetCabinetBuilderBootstrap(state) {
      state.hasBootstrappedCabinetBuilder = false;
    },
    resetPrebuiltProducts(state) {
      state.productsPresets = [];
    },
    setCabinetCatalog(state, action: PayloadAction<ConfiguratorCatalog>) {
      state.cabinetCatalog = action.payload;
      applyRulesToState(state);
    },
    /**
     * Atomically replaces every input owned by the active collection.
     *
     * A collection switch cannot merge defaults over the previous collection or keep
     * an omitted catalog. Other product/session state remains owned by its existing
     * reducers and by C's command lifecycle.
     */
    replaceCollectionData(
      state,
      action: PayloadAction<{ profile: ProductProfile | null; cabinetCatalog: ConfiguratorCatalog | null }>,
    ) {
      state.activeProfile = action.payload.profile;
      state.cabinetCatalog = action.payload.cabinetCatalog ?? { typeCabinetRules: [] };
      state.productOptions = {
        ...EMPTY_PRODUCT_OPTIONS,
        ...applyProfileDefaults(action.payload.profile),
      };
      applyRulesToState(state);
    },
    /**
     * Supplied by A once the active collection is loaded and validated.
     * Dispatched at bootstrap, before anything is rendered or chosen, so applying the
     * collection defaults here cannot overwrite a user selection.
     */
    setActiveProfile(state, action: PayloadAction<ProductProfile | null>) {
      state.activeProfile = action.payload;
      state.productOptions = { ...state.productOptions, ...applyProfileDefaults(action.payload) };
      applyRulesToState(state);
    },
    addProductPreset(state, action: PayloadAction<PresetProduct[]>) {
      state.productsPresets = action.payload;
    },

    setPlacedCabinetStyle(state, action: PayloadAction<{ id: string; value: string }>) {
      state.placedCabinetStyles[action.payload.id] = action.payload.value;
    },
    updateAllPlacedCabinetStyles(state, action: PayloadAction<string>) {
      Object.keys(state.placedCabinetStyles).forEach((id) => {
        state.placedCabinetStyles[id] = action.payload;
      });
    },
    /** Atomically switches drawer style for all placed cabinets + updates selectedProductConfig in one reducer call,
     *  ensuring dominantDrawerGroup and dimensionOptions are both correct in the same render cycle.
     *  forcedHeight: the height already sent to PlayCanvas by the caller — used to override the
     *  rule engine result when supportsHeightForAllProducts would otherwise block the height change. */
    switchAllCabinetsDrawerStyle(
      state,
      action: PayloadAction<{
        configValue: string;
        rawValue: string;
        forcedHeight?: number | null;
        forcedHandle?: string | null;
      }>,
    ) {
      const { configValue, rawValue, forcedHeight, forcedHandle } = action.payload;

      if (state.selectedProductConfig) {
        state.selectedProductConfig = { ...state.selectedProductConfig, Drawers: configValue };
      } else {
        state.selectedProductConfig = { Drawers: configValue };
      }

      Object.keys(state.placedCabinetStyles).forEach((id) => {
        state.placedCabinetStyles[id] = rawValue;
      });

      applyRulesToState(state);

      // Override with values already applied to PlayCanvas so Redux stays in sync
      if (typeof forcedHeight === "number") {
        state.selectedDimensions.height = forcedHeight;
      }
      if (forcedHandle && state.selectedProductConfig) {
        state.selectedProductConfig = { ...state.selectedProductConfig, Handle: forcedHandle };
      }
    },
    setDrawerProduct(state, action: PayloadAction<string>) {
      state.activeDrawerProduct = action.payload;
    },
    setActiveCabinetType(state, action: PayloadAction<string | null>) {
      const previousCabinetType = state.activeCabinetType;
      const newCabinetTypeId = action.payload;

      state.activeCabinetType = newCabinetTypeId;

      // When switching to a new cabinet type, set a default height if current height is invalid
      if (newCabinetTypeId !== previousCabinetType && newCabinetTypeId !== null) {
        const cabinetRule = state.cabinetCatalog.typeCabinetRules.find((rule) => rule.code === newCabinetTypeId);

        if (cabinetRule && cabinetRule.heights.length > 0) {
          const currentHeight = state.selectedDimensions.height;
          const isCurrentHeightValid = typeof currentHeight === "number" && cabinetRule.heights.includes(currentHeight);

          // If current height is not valid for the new cabinet type, use the last available height
          // (typically the default/preferred height for that cabinet type)
          if (!isCurrentHeightValid) {
            // const currentHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle);
            // const hasForcedHandle = currentHandle === "handle_pto" || currentHandle === "handle_urban_topcut" || currentHandle === "handle_urban_botcut";

            // if (!hasForcedHandle) {
            const defaultHeight = cabinetRule.heights[cabinetRule.heights.length - 1];
            state.selectedDimensions.height = defaultHeight;
            // }
          }
        }
      }

      applyRulesToState(state, { field: "cabinetType", value: newCabinetTypeId });
    },
    // TODO(architecture): single-source-of-truth for dimensions.
    // Current state keeps width/depth/height in three slots:
    //   1. selectedDimensions — authoritative, updated on resize
    //   2. productsPresets[*].Width/Depth/Height — snapshot, NOT updated on resize
    //   3. selectedProductConfig.Width/Depth/Height — snapshot from last cabinet click,
    //      NOT updated on resize
    // Consumers that read (2) or (3) for current dimensions get stale values.
    // Prefer reading from selectedDimensions OR from live scene via getConfig().
    // See Summary page total-width / SKU calculations for drift risk.
    setSelectedDimensions(state, action: PayloadAction<Partial<ProductDimensions>>) {
      state.selectedDimensions = { ...state.selectedDimensions, ...action.payload };
      const [intentField, intentValue] = Object.entries(action.payload)[0] ?? [];

      if (intentField) {
        const intent: Intent = { field: intentField as Intent["field"], value: intentValue as Intent["value"] };

        applyRulesToState(state, intent);
      } else {
        applyRulesToState(state);
      }
    },
    syncSelectedDimensionsFromScene(state, action: PayloadAction<Partial<ProductDimensions>>) {
      state.selectedDimensions = { ...state.selectedDimensions, ...action.payload };
    },
    /**
     * Records values the command service has already applied in the scene.
     *
     * The rules run once to refresh availability, but they do not re-derive these values:
     * the command planned the dependent handle, height and groove reset itself, so deriving
     * them again here would make the reducer a second owner of the same values.
     * `drawers` is the legacy spelling ("1D"); per-cabinet drawers are recorded separately.
     */
    commitRuleSelection(state, action: PayloadAction<{ handle?: string; height?: number; drawers?: string }>) {
      const { handle, height, drawers } = action.payload;

      if (handle !== undefined) {
        state.selectedProductConfig = { ...(state.selectedProductConfig ?? {}), Handle: handle };
      }

      if (drawers !== undefined) {
        state.selectedProductConfig = { ...(state.selectedProductConfig ?? {}), Drawers: drawers };
      }

      if (height !== undefined) {
        state.selectedDimensions = { ...state.selectedDimensions, height };
      }

      const committedDimensions = { ...state.selectedDimensions };
      const committedConfig = state.selectedProductConfig ? { ...state.selectedProductConfig } : null;

      applyRulesToState(state);

      state.selectedDimensions = committedDimensions;
      state.selectedProductConfig = committedConfig;
    },
    setSelectedProductConfig(state, action: PayloadAction<ProductConfig | null>) {
      const prevHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle, state.activeProfile);

      // Preserve Handle from previous config if new config doesn't have one
      const preservedHandle = action.payload?.Handle ? action.payload.Handle : state.selectedProductConfig?.Handle;

      state.selectedProductConfig = action.payload
        ? {
            ...action.payload,
            ...(preservedHandle && !action.payload.Handle ? { Handle: preservedHandle } : {}),
          }
        : preservedHandle
          ? { Handle: preservedHandle }
          : null;

      const nextHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle, state.activeProfile);

      // When the handle changes to one that forces a different height, apply that height
      // instead of restoring a pre-change snapshot (which can drift across sessions or
      // differ from the new handle's required height — e.g. CG→PTO→UG needs 56, not 53).
      //
      // Previously this was gated on leaving "handle_pto". The generic form is the
      // forced heights of the two handles differing, which is what made PTO special in
      // the USH data: it is the only handle whose forced height differs from the others.
      if (prevHandle !== nextHandle && nextHandle !== null) {
        const drawers = mapDrawerConfigToRule(state.selectedProductConfig?.Drawers, state.activeProfile);
        const forcedHeightFor = (handle: string | null) =>
          resolveForcedHeightForHandle({
            catalog: state.cabinetCatalog,
            cabinetType: state.activeCabinetType,
            drawers,
            handle,
          });

        const targetHeight = forcedHeightFor(nextHandle);

        if (typeof targetHeight === "number" && forcedHeightFor(prevHandle) !== targetHeight) {
          state.selectedDimensions.height = targetHeight;
        }
      }

      // Clear the groove color when leaving a handle that supports it for one that does not.
      // Applicability comes from the option capability, so a new groove handle needs no id here.
      const hadGroove = hasCapability(state.activeProfile, "Handle", prevHandle, "supportsGrooveColor");
      const hasGroove = hasCapability(state.activeProfile, "Handle", nextHandle, "supportsGrooveColor");

      if (hadGroove && !hasGroove) {
        state.productOptions.HandleGrooveColor = "";
        state.productOptions.HandleGrooveColorSku = "";
      }

      applyRulesToState(state);
    },
    setCabinetColor(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColor = action.payload;
    },
    setCabinetColorSku(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColorSku = action.payload;
    },
    setCabinetColorMaterial(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColorMaterial = action.payload;
    },
    setCabinetColorFinish(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColorFinish = action.payload;
    },
    setHandleGrooveColor(state, action: PayloadAction<string>) {
      state.productOptions.HandleGrooveColor = action.payload;
    },
    setHandleGrooveColorSku(state, action: PayloadAction<string>) {
      state.productOptions.HandleGrooveColorSku = action.payload;
    },
    setActiveBasinStyle(state, action: PayloadAction<string>) {
      state.productOptions.sinkType = action.payload;
    },
    setActiveCountertopColor(state, action: PayloadAction<string>) {
      state.productOptions.CountertopColor = action.payload;
    },
    setCountertopColorSku(state, action: PayloadAction<string>) {
      state.productOptions.CountertopColorSku = action.payload;
    },
    setVesselColor(state, action: PayloadAction<string>) {
      state.productOptions.VesselColor = action.payload;
    },
    setActiveCountertopThickness(state, action: PayloadAction<string>) {
      state.productOptions.Thickness = action.payload;
    },
    setDrawerPanelFluting(state, action: PayloadAction<string>) {
      state.productOptions.DrawerPanelFluting = action.payload;
    },
    setGrainDirection(state, action: PayloadAction<string>) {
      state.productOptions.GrainDirection = action.payload;
    },
    setBookMatching(state, action: PayloadAction<string>) {
      state.productOptions.BookMatching = action.payload;
    },
    setCountertopStyle(state, action: PayloadAction<string>) {
      state.productOptions.CountertopStyle = action.payload;
    },
    setSidePanelsOption(state, action: PayloadAction<string>) {
      state.productOptions.SidePanels = action.payload;
    },
    setSidePanelSideStatus(
      state,
      action: PayloadAction<{ side: "left" | "right"; status: "active" | "none" | "auto-removed" }>,
    ) {
      const { side, status } = action.payload;
      const key = side === "left" ? "SidePanelLeft" : "SidePanelRight";
      state.productOptions[key] = status;
    },
    setLedOption(state, action: PayloadAction<string>) {
      state.productOptions.LedOption = action.payload;
    },
    setDividersOption(state, action: PayloadAction<string>) {
      state.productOptions.DividersOption = action.payload;
    },
    setDividersStyle(state, action: PayloadAction<string>) {
      state.productOptions.DividersStyle = action.payload;
      // Single place where the "Option X" label is parsed into the domain type.
      state.selectedDividerType = getDividerTypeFromOptionTitle(action.payload);
    },
    replacePlacedDividersForDrawer(
      state,
      action: PayloadAction<{
        cabinetId: string;
        drawerType: PlacedDivider["drawerType"];
        dividers: PlacedDivider[];
      }>,
    ) {
      const { cabinetId, drawerType, dividers } = action.payload;
      state.placedDividers = [
        ...state.placedDividers.filter(
          (divider) => divider.cabinetId !== cabinetId || divider.drawerType !== drawerType,
        ),
        ...dividers,
      ];
    },
    replacePlacedDividersForCabinet(state, action: PayloadAction<{ cabinetId: string; dividers: PlacedDivider[] }>) {
      const { cabinetId, dividers } = action.payload;
      state.placedDividers = [
        ...state.placedDividers.filter((divider) => divider.cabinetId !== cabinetId),
        ...dividers,
      ];
    },
    clearTopPlacedDividersForCabinets(state, action: PayloadAction<string[]>) {
      const cabinetIds = new Set(action.payload);
      state.placedDividers = state.placedDividers.filter(
        (divider) => !cabinetIds.has(divider.cabinetId) || divider.drawerType === "Bot",
      );
    },
    clearPlacedDividers(state) {
      state.placedDividers = [];
    },
    setTowelBarOption(state, action: PayloadAction<string>) {
      state.productOptions.TowelBarOption = action.payload;
    },
    setTowelBarColor(state, action: PayloadAction<string>) {
      state.productOptions.TowelBarColor = action.payload;
    },
    setFaucetHolesAmount(state, action: PayloadAction<string>) {
      state.productOptions.FaucetHolesAmount = action.payload;
    },
    setFaucetHolesSpacing(state, action: PayloadAction<string>) {
      state.productOptions.FaucetHolesSpacing = action.payload;
    },

    setSelectedSceneProduct(state, action: PayloadAction<string>) {
      state.selectedSceneProduct = action.payload;
    },
    setIsDrawerOpen(state, action: PayloadAction<boolean>) {
      state.isDrawerOpen = action.payload;
    },
    setHasBootstrappedCabinetBuilder(state, action: PayloadAction<boolean>) {
      state.hasBootstrappedCabinetBuilder = action.payload;
    },
    restoreProductState(
      state,
      action: PayloadAction<{
        productIds: string[];
        productOptions: ProductState["productOptions"];
        activeCabinetType: string | null;
        selectedDimensions: { width: number | null; height: number | null; depth: number | null };
        placedDividers?: PlacedDivider[];
        selectedProductConfig?: ProductConfig | null;
        placedCabinetStyles?: Record<string, string>;
        productsPresets?: PresetProduct[];
      }>,
    ) {
      const {
        productIds,
        productOptions,
        activeCabinetType,
        selectedDimensions,
        placedDividers,
        selectedProductConfig,
        placedCabinetStyles,
        productsPresets,
      } = action.payload;
      state.productIds = productIds;
      state.productOptions = productOptions;
      // History snapshots only persist the DividersStyle label — re-derive the
      // domain type so undo/redo never desynchronizes the label/type pair.
      state.selectedDividerType = getDividerTypeFromOptionTitle(productOptions.DividersStyle ?? "");
      state.activeCabinetType = activeCabinetType;
      state.selectedDimensions = selectedDimensions;
      state.placedDividers = placedDividers ?? [];
      state.selectedProductConfig = selectedProductConfig ?? null;
      state.placedCabinetStyles = placedCabinetStyles ?? {};
      if (productsPresets !== undefined) {
        state.productsPresets = productsPresets.map((preset) => ({ ...preset }));
      }
      state.compositionVersion += 1;
      applyRulesToState(state);
    },
  },
});

export const {
  addProductId,
  addProductPreset,
  removeProductId,
  setPlacedCabinetStyle,
  swapProductIds,
  recordComposition,
  insertProductIdRelative,
  reset,
  setActiveCabinetType,
  setSelectedDimensions,
  syncSelectedDimensionsFromScene,
  commitRuleSelection,
  setDrawerProduct,
  setSelectedProductConfig,
  setCabinetColor,
  setCabinetColorSku,
  setCabinetColorMaterial,
  setCabinetColorFinish,
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  resetProducts,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setCountertopColorSku,
  setVesselColor,
  setActiveCountertopThickness,
  setDrawerPanelFluting,
  setGrainDirection,
  setBookMatching,
  setCountertopStyle,
  setSidePanelsOption,
  setSidePanelSideStatus,
  setLedOption,
  setDividersOption,
  setDividersStyle,
  replacePlacedDividersForDrawer,
  replacePlacedDividersForCabinet,
  clearTopPlacedDividersForCabinets,
  clearPlacedDividers,
  setTowelBarOption,
  setTowelBarColor,
  setFaucetHolesAmount,
  setFaucetHolesSpacing,
  resetPrebuiltProducts,
  setCabinetCatalog,
  replaceCollectionData,
  setActiveProfile,
  setSelectedSceneProduct,
  setIsDrawerOpen,
  resetCabinetBuilderBootstrap,
  setHasBootstrappedCabinetBuilder,
  restoreProductState,
  updateAllPlacedCabinetStyles,
  switchAllCabinetsDrawerStyle,
} = productSlice.actions;
export const productReducer = productSlice.reducer;
