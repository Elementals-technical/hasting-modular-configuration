import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { Outlet, useMatch, useSearchParams } from "react-router-dom";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS,
  subscribeToInteractiveConfiguratorTutorialEnterCustomMode,
} from "@/features/interactiveConfiguratorTutorial";
import { CreateModelBtn } from "@/entities/product/ui/createModelBtn/CreateModelBtn";

import { arePrebuiltModelPresetsEqual } from "@/entities/product/lib/arePrebuiltModelPresetsEqual";
import { mergePrebuiltModelTransferableOverrides } from "@/entities/product/lib/mergePrebuiltModelTransferableOverrides";
import {
  PREBUILT_MODEL_COLOR_TRANSFERABLE_FIELDS,
  PREBUILT_MODEL_COUNTERTOP_TRANSFERABLE_FIELDS,
  resolvePrebuiltModelTransferableOverrides,
} from "@/entities/product/lib/prebuiltModelTransferableFields";
import { type PresetProduct, type ProductSize, type ProductStyle } from "@/entities/product/types";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ModeSwitcher } from "@/shared/ui/ModeSwitcher/ModeSwitcher";

import { ProductModelsGrid } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";
import { useActiveCollection, useCollectionPresets } from "@/entities/collection";
import { useCollectionNavigation, useStepNavigate } from "@/features/collectionCustomization";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  addProductPreset,
  reset,
  resetCabinetBuilderBootstrap,
  resetPrebuiltProducts,
  setCountertopColorSku,
  replacePlacedDividersForCabinet,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import {
  getActiveCountertopThickness,
  getActiveCountertopColor,
  getCabinetColor,
  getCountertopColorSku,
  getCountertopStyle,
  getHandleGrooveColor,
  getProductsPresets,
  getSinkType,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import {
  findCountertopSkuByColorName,
  resolveIntegratedCountertopBasinFallback,
  resolvePrebuiltModelCountertopCompatibility,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import { BaseButton, ROUTES } from "@/shared";
import { AttentionPopup } from "@/shared/ui/Popups/ui/AttentionPopup/AttentionPopup";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import type { SceneRestoreMatch } from "@/entities/configuration";
import { useChangeAttribute, type ReplayValues } from "@/features/configurationCommands";
import { useRestoreSavedConfiguration, type RestorePlan } from "@/features/configurationRestore";
import { buildPresetFromConfiguration } from "@/utils/buildPresetFromConfiguration";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import {
  clearSidePanels,
  isGrooveType,
  reapplySidePanelsForPreset,
  restoreSidePanelState,
  type SidePanelStatus,
} from "@/features/sidePanel";
import { enforceSidePanelEligibility } from "@/features/sidePanel/lib/sidePanelEnforce";
import { getActiveProductProfile } from "@/entities/configuration/model/store/selectors";
import { getSidePanelsOption } from "@/entities/product/model/store/selectors";
import { clearHistory } from "@/entities/history/model/store/slice";
import { applySwatchOrderFromMetadata } from "@/features/swatchOrder";
import { collectPlacedDividersFromConfig, pickDividerConfigPatch } from "@/utils/functions/playcanvas/dividers";
import { applyDividerZones } from "@/features/dividers";
import {
  buildCountertopColorSkuCandidates,
  getCountertopMaterialTokensFromBasinType,
  resolveDefaultBasinForCountertopSelection,
  resolveCountertopColorSkuFromCandidates,
  resolveCountertopMaterialTokensFromCandidates,
} from "@/shared/lib/sku";
import { trackModularCustomizeClick } from "@/shared/lib/analytics/modularKeyEvents";
import { optionsMockData3 } from "../countertop/constants";

import s from "./ModelPage.module.scss";

const inferCountertopStyleFromSinkType = (sinkType: string): "Vessel" | "Integrated" => {
  const trimmed = sinkType.trim();
  if (trimmed === "Vessel" || trimmed.startsWith("Vessel_")) return "Vessel";
  return "Integrated";
};

type PresetSceneDefaults = {
  CabinetColor?: string;
  HandleGrooveColor?: string;
  CountertopColor?: string;
  sinkType?: string;
  CountertopStyle?: "Vessel" | "Integrated";
  VesselColor?: string;
  Thickness?: string;
};

type PendingModelSelection = {
  presetProducts: PresetProduct[];
  presetId?: number;
  modelTitle: string;
  reason?: string;
};

type ApplyPresetSelectionOptions = {
  syncUrl?: boolean;
  preserveCountertopSelections?: boolean;
};

/** The scene values of a preset as configuration values, without the ones it leaves unset. */
const toConfigurationValues = (config: PresetSceneDefaults): Record<string, string> =>
  Object.fromEntries(
    Object.entries(config).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
    ),
  );

/**
 * The countertop and basin values placing a preset does not settle: each product's own config
 * wins over the shared values, so they are shown again once the products are placed.
 */
const countertopValuesAfterPlacement = (config: PresetSceneDefaults): ReplayValues =>
  toConfigurationValues({
    sinkType: config.sinkType,
    CountertopStyle: config.CountertopStyle,
    CountertopColor: config.CountertopColor,
    Thickness: config.Thickness,
  });

const toCompositionProducts = (presetProducts: PresetProduct[]) =>
  presetProducts.map((preset) => ({ productType: preset.name, config: { ...preset } }));

const resolvePresetSceneDefaults = (presetProducts?: PresetProduct[]): PresetSceneDefaults => {
  if (!presetProducts?.length) return {};

  const firstWithCountertop = presetProducts.find(
    (p) => typeof p.CountertopColor === "string" && p.CountertopColor.trim(),
  );
  const firstWithSink = presetProducts.find((p) => typeof p.sinkType === "string" && p.sinkType.trim());

  const globalConfig: PresetSceneDefaults = {};
  if (firstWithCountertop?.CountertopColor) globalConfig.CountertopColor = firstWithCountertop.CountertopColor;
  if (firstWithSink?.sinkType) {
    globalConfig.sinkType = firstWithSink.sinkType;
    globalConfig.CountertopStyle = inferCountertopStyleFromSinkType(firstWithSink.sinkType);
  }

  return globalConfig;
};

const resolvePrebuiltPresetCountertopDimensions = (presetProducts: PresetProduct[]) => {
  const totalWidthValues = presetProducts.map((preset) =>
    typeof preset.Width === "number" && Number.isFinite(preset.Width) ? preset.Width : null,
  );
  const totalWidth = totalWidthValues.some((value) => value !== null)
    ? totalWidthValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const sinkBasePreset = presetProducts.find((preset) => preset.name === "Sink-Base");

  return {
    sinkBaseWidth:
      typeof sinkBasePreset?.Width === "number" && Number.isFinite(sinkBasePreset.Width) ? sinkBasePreset.Width : null,
    totalWidth,
    depth:
      typeof sinkBasePreset?.Depth === "number" && Number.isFinite(sinkBasePreset.Depth) ? sinkBasePreset.Depth : null,
  };
};

export const ModelPage = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const activeCollection = useActiveCollection();
  // Read at call time inside the preset and restore flows, so a loaded profile does not re-run their effects.
  const activeProfile = useAppSelector(getActiveProductProfile);
  const activeProfileRef = useRef(activeProfile);
  useEffect(() => {
    activeProfileRef.current = activeProfile;
  }, [activeProfile]);
  const navigate = useStepNavigate();
  const { composition, replay, record } = useChangeAttribute();
  const [searchParams, setSearchParams] = useSearchParams();
  const modelStepPath = useCollectionNavigation()?.currentStep?.path ?? "/prebuilt/model";
  const detailMatch = useMatch(`${modelStepPath}/:modelId`);
  const detailModelId = detailMatch?.params.modelId;
  const isDetail = !!detailMatch;
  const isDefinedProductsRef = useRef(false);
  const presetSelectionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const presetSelectionRequestIdRef = useRef(0);
  const productsPresets = useAppSelector(getProductsPresets);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const activeBasinStyle = useAppSelector(getSinkType);
  const vesselColor = useAppSelector(getVesselColor);
  const spGroove = useAppSelector(getSidePanelsOption);
  const configuratorGroups = activeCollection.catalog.configurator.groups;
  const countertopRules = useCountertopRules();
  const [pendingModelSelection, setPendingModelSelection] = useState<PendingModelSelection | null>(null);
  const [sizeFilter, setSizeFilter] = useState<ProductSize | "all">("all");
  const [styleFilter, setStyleFilter] = useState<ProductStyle | "all">("all");
  const modelScrollPositionKey = "prebuilt:model:scrollTop";
  const modelScrollRestoreFlagKey = "prebuilt:model:restore-scroll";

  const getStepContentContainer = useCallback(() => {
    const container = rootRef.current?.closest('[data-scroll-container="step-content"]');
    return container instanceof HTMLElement ? container : null;
  }, []);

  const presets = useCollectionPresets();
  const defaultPresetId = Number(activeCollection.manifest.defaultPresetId);
  const defaultPreset = presets.find((preset) => preset.id === defaultPresetId) ?? presets[0] ?? null;

  const filteredData = useMemo(() => {
    return presets.filter((preset) => {
      if (sizeFilter !== "all" && preset.size !== sizeFilter) return false;
      if (styleFilter !== "all" && !preset.style.includes(styleFilter)) return false;
      return true;
    });
  }, [presets, sizeFilter, styleFilter]);

  const presetIdFromUrl = useMemo(() => {
    const rawPresetId = searchParams.get("preset");
    if (!rawPresetId) return null;

    const parsedPresetId = Number(rawPresetId);
    if (!Number.isFinite(parsedPresetId)) return null;

    return parsedPresetId;
  }, [searchParams]);
  const configIdFromUrl = useMemo(() => searchParams.get("configId"), [searchParams]);
  const selectedCountertopSinkType = useMemo(() => {
    if (activeBasinStyle) return activeBasinStyle;
    return countertopStyle.trim().toLowerCase() === "vessel" ? "Vessel" : undefined;
  }, [activeBasinStyle, countertopStyle]);
  const colorTransferableOverrides = useMemo(
    () =>
      resolvePrebuiltModelTransferableOverrides({
        presetProducts: productsPresets,
        selectedOptions: {
          CabinetColor: cabinetColor,
          HandleGrooveColor: handleGrooveColor,
        },
        fields: PREBUILT_MODEL_COLOR_TRANSFERABLE_FIELDS,
      }),
    [cabinetColor, handleGrooveColor, productsPresets],
  );
  const countertopTransferableOverrides = useMemo(
    () =>
      resolvePrebuiltModelTransferableOverrides({
        presetProducts: productsPresets,
        selectedOptions: {
          CountertopColor: countertopColor,
          sinkType: selectedCountertopSinkType,
        },
        fields: PREBUILT_MODEL_COUNTERTOP_TRANSFERABLE_FIELDS,
      }),
    [countertopColor, productsPresets, selectedCountertopSinkType],
  );
  const transferableOverrides = useMemo(
    () => ({
      ...colorTransferableOverrides,
      ...countertopTransferableOverrides,
    }),
    [colorTransferableOverrides, countertopTransferableOverrides],
  );
  const countertopColorSkuCandidatesByValue = useMemo(
    () => buildCountertopColorSkuCandidates(configuratorGroups),
    [configuratorGroups],
  );
  const activeCountertopMaterialTokens = useMemo(
    () =>
      resolveCountertopMaterialTokensFromCandidates({
        value: countertopColor,
        candidatesByValue: countertopColorSkuCandidatesByValue,
        preferredSku: countertopColorSku,
        preferredMaterialTokens: getCountertopMaterialTokensFromBasinType(selectedCountertopSinkType),
      }),
    [countertopColor, countertopColorSku, countertopColorSkuCandidatesByValue, selectedCountertopSinkType],
  );
  const resolveCountertopSkuForSelection = useCallback(
    (color?: string | null, sinkType?: string | null): string => {
      if (!color) return "";

      return (
        resolveCountertopColorSkuFromCandidates({
          value: color,
          candidatesByValue: countertopColorSkuCandidatesByValue,
          preferredMaterialTokens: getCountertopMaterialTokensFromBasinType(sinkType),
        }) ??
        findCountertopSkuByColorName(configuratorGroups, color) ??
        ""
      );
    },
    [configuratorGroups, countertopColorSkuCandidatesByValue],
  );
  const syncCountertopSelectionFromSceneConfig = useCallback(
    (globalConfig: PresetSceneDefaults, options?: { clearMissing?: boolean }) => {
      const clearMissing = options?.clearMissing === true;
      const cleared: Record<string, string> = clearMissing
        ? { CountertopColor: "", sinkType: "", CountertopStyle: "" }
        : {};

      // The placed preset already shows these values; they are recorded, then the colour's SKU.
      record({
        ...cleared,
        ...toConfigurationValues({
          CountertopColor: globalConfig.CountertopColor,
          sinkType: globalConfig.sinkType,
          CountertopStyle: globalConfig.CountertopStyle,
        }),
      });

      if (globalConfig.CountertopColor) {
        dispatch(
          setCountertopColorSku(resolveCountertopSkuForSelection(globalConfig.CountertopColor, globalConfig.sinkType)),
        );
      } else if (clearMissing) {
        dispatch(setCountertopColorSku(""));
      }
    },
    [dispatch, record, resolveCountertopSkuForSelection],
  );
  const resolveCountertopMaterialTokensForSceneConfig = useCallback(
    (globalConfig: PresetSceneDefaults): string[] => {
      const preferredMaterialTokens = getCountertopMaterialTokensFromBasinType(globalConfig.sinkType);
      const resolvedTokens = resolveCountertopMaterialTokensFromCandidates({
        value: globalConfig.CountertopColor,
        candidatesByValue: countertopColorSkuCandidatesByValue,
        preferredSku: resolveCountertopSkuForSelection(globalConfig.CountertopColor, globalConfig.sinkType),
        preferredMaterialTokens,
      });

      return resolvedTokens.length ? resolvedTokens : preferredMaterialTokens;
    },
    [countertopColorSkuCandidatesByValue, resolveCountertopSkuForSelection],
  );

  const presetFromUrl = useMemo(() => {
    if (presetIdFromUrl === null) return null;
    return presets.find((preset) => preset.id === presetIdFromUrl) ?? null;
  }, [presetIdFromUrl, presets]);

  const handleSizeFilter = useCallback((value?: string | number) => {
    if (value === undefined) {
      setSizeFilter("all");
      return;
    }
    setSizeFilter(value === "all" ? "all" : (value as ProductSize));
  }, []);

  const handleStyleFilter = useCallback((value?: string | number) => {
    if (value === undefined) {
      setStyleFilter("all");
      return;
    }
    setStyleFilter(value === "all" ? "all" : (value as ProductStyle));
  }, []);

  // Define Selected dimentions for the countertop logic.
  const updateSelectedDimensionsFromScene = useCallback(
    async (presetProducts?: PresetProduct[], runtimeIds: readonly string[] = []) => {
      if (!presetProducts?.length) return;

      const entries = await Promise.all(
        presetProducts.map(async (preset, index) => {
          // The scene answers for a placed product by its runtime id; without one the preset's own size is used.
          const runtimeId = runtimeIds[index];
          const config = runtimeId ? await getConfig(runtimeId) : null;
          const width =
            typeof config?.Width === "number" ? config.Width : typeof preset.Width === "number" ? preset.Width : null;
          const depth =
            typeof config?.Depth === "number" ? config.Depth : typeof preset.Depth === "number" ? preset.Depth : null;
          const height =
            typeof config?.Height === "number"
              ? config.Height
              : typeof preset.Height === "number"
                ? preset.Height
                : null;

          return { width, depth, height };
        }),
      );

      const first = entries.find(
        (entry) => entry && (entry.width !== null || entry.depth !== null || entry.height !== null),
      );
      if (!first) return;

      const next: { width?: number; depth?: number; height?: number } = {};
      if (first.width !== null) next.width = first.width;
      if (first.depth !== null) next.depth = first.depth;
      if (first.height !== null) next.height = first.height;

      if (Object.keys(next).length) {
        dispatch(setSelectedDimensions(next));
      }
    },
    [dispatch],
  );

  const activePresetId = useMemo(() => {
    const target = productsPresets.length ? productsPresets : (defaultPreset?.presetProducts ?? []);

    const match = presets.find((preset) => arePrebuiltModelPresetsEqual(preset.presetProducts, target));

    return match?.id ?? defaultPreset?.id ?? null;
  }, [productsPresets, presets, defaultPreset]);

  const resolveCountertopSceneOverrides = useCallback((): PresetSceneDefaults => {
    const overrides: PresetSceneDefaults = {};
    if (countertopColor) overrides.CountertopColor = countertopColor;
    if (vesselColor) overrides.VesselColor = vesselColor;
    if (countertopThickness) overrides.Thickness = countertopThickness;
    if (selectedCountertopSinkType) {
      overrides.sinkType = selectedCountertopSinkType;
      overrides.CountertopStyle = inferCountertopStyleFromSinkType(selectedCountertopSinkType);
    }
    if (countertopStyle) {
      const normalizedStyle = countertopStyle.trim().toLowerCase();
      if (normalizedStyle === "vessel") overrides.CountertopStyle = "Vessel";
      if (normalizedStyle === "integrated") overrides.CountertopStyle = "Integrated";
    }
    return overrides;
  }, [countertopColor, countertopStyle, countertopThickness, selectedCountertopSinkType, vesselColor]);

  const resolveColorSceneOverrides = useCallback((): PresetSceneDefaults => {
    const overrides: PresetSceneDefaults = {};
    if (cabinetColor) overrides.CabinetColor = cabinetColor;
    if (handleGrooveColor) overrides.HandleGrooveColor = handleGrooveColor;
    return overrides;
  }, [cabinetColor, handleGrooveColor]);

  const resetRestrictedCountertopSelections = useCallback(() => {
    record({ Thickness: "", VesselColor: "", FaucetHolesAmount: "0" });
  }, [record]);

  const resolveCompatibleCountertopSceneConfig = useCallback(
    (globalConfig: PresetSceneDefaults, presetProducts: PresetProduct[]): PresetSceneDefaults => {
      if (globalConfig.CountertopStyle !== "Integrated" || !globalConfig.sinkType) return globalConfig;

      const materialTokens = resolveCountertopMaterialTokensForSceneConfig(globalConfig);
      if (!materialTokens.length) return globalConfig;

      const fallbackBasinStyle = resolveIntegratedCountertopBasinFallback({
        basinOptions: optionsMockData3,
        rules: countertopRules,
        activeMaterialTokens: materialTokens,
        activeThickness: globalConfig.Thickness ?? countertopThickness,
        activeBasinStyle: globalConfig.sinkType,
        preferredBasinStyle: resolveDefaultBasinForCountertopSelection({
          countertopColor: globalConfig.CountertopColor,
          materialTokens,
        }),
        dimensions: resolvePrebuiltPresetCountertopDimensions(presetProducts),
      });

      if (!fallbackBasinStyle || fallbackBasinStyle === globalConfig.sinkType) return globalConfig;

      return {
        ...globalConfig,
        sinkType: fallbackBasinStyle,
        CountertopStyle: inferCountertopStyleFromSinkType(fallbackBasinStyle),
      };
    },
    [countertopRules, countertopThickness, resolveCountertopMaterialTokensForSceneConfig],
  );

  const applyPresetSelection = useCallback(
    async (
      presetProducts?: PresetProduct[],
      presetId?: number,
      options?: ApplyPresetSelectionOptions,
    ) => {
      const requestId = presetSelectionRequestIdRef.current + 1;
      presetSelectionRequestIdRef.current = requestId;

      const runSelection = async () => {
        if (requestId !== presetSelectionRequestIdRef.current) return;

        const preserveCountertopSelections = options?.preserveCountertopSelections !== false;
        const overrides = preserveCountertopSelections ? transferableOverrides : colorTransferableOverrides;
        const effectivePresetProducts = mergePrebuiltModelTransferableOverrides(presetProducts ?? [], overrides);
        const globalConfig = resolveCompatibleCountertopSceneConfig(
          {
            ...resolvePresetSceneDefaults(effectivePresetProducts),
            ...resolveColorSceneOverrides(),
            ...(preserveCountertopSelections ? resolveCountertopSceneOverrides() : {}),
          },
          effectivePresetProducts,
        );
        await clearSidePanels(dispatch);
        const placed = await composition.applyPreset({
          products: toCompositionProducts(effectivePresetProducts),
          shared: toConfigurationValues(globalConfig),
          afterPlacement: countertopValuesAfterPlacement(globalConfig),
        });
        if (placed.status === "error") {
          console.warn("[Prebuilt] The preset was not placed", placed);
          return;
        }
        const sceneProductIds = placed.productIds;

        if (effectivePresetProducts.length) {
          dispatch(addProductPreset(effectivePresetProducts));
          syncCountertopSelectionFromSceneConfig(globalConfig, { clearMissing: !preserveCountertopSelections });
        }
        if (!preserveCountertopSelections) {
          resetRestrictedCountertopSelections();
        }
        await updateSelectedDimensionsFromScene(effectivePresetProducts, sceneProductIds);

        // Re-apply side panels to match the new preset's handle/height/drawers
        if (spGroove && spGroove !== "None" && effectivePresetProducts.length) {
          await reapplySidePanelsForPreset(
            dispatch,
            activeProfileRef.current,
            spGroove,
            effectivePresetProducts,
            effectivePresetProducts.length,
            sceneProductIds,
          );
        }

        const presetCabinetColor = effectivePresetProducts.find(
          (p) => typeof p.CabinetColor === "string" && p.CabinetColor,
        )?.CabinetColor;
        if (presetCabinetColor) record({ CabinetColor: presetCabinetColor });

        dispatch(clearHistory());

        if (presetId && options?.syncUrl !== false) {
          const nextSearchParams = new URLSearchParams(searchParams);
          nextSearchParams.set("preset", String(presetId));
          setSearchParams(nextSearchParams);
        }
      };

      const queuedSelection = presetSelectionQueueRef.current.then(runSelection, runSelection);
      presetSelectionQueueRef.current = queuedSelection.then(
        () => undefined,
        () => undefined,
      );

      try {
        await queuedSelection;
      } catch (error) {
        console.error("[ProductModelItem] Failed to apply preset", error);
      }
    },
    [
      colorTransferableOverrides,
      composition,
      dispatch,
      record,
      resetRestrictedCountertopSelections,
      resolveCompatibleCountertopSceneConfig,
      resolveColorSceneOverrides,
      resolveCountertopSceneOverrides,
      searchParams,
      setSearchParams,
      syncCountertopSelectionFromSceneConfig,
      transferableOverrides,
      updateSelectedDimensionsFromScene,
      spGroove,
    ],
  );

  const handleAddPreset = useCallback(
    async (
      presetProducts?: PresetProduct[],
      presetId?: number,
      options?: { syncUrl?: boolean; skipCompatibilityPrompt?: boolean },
    ) => {
      if (!presetProducts?.length) {
        await applyPresetSelection(presetProducts, presetId, options);
        return;
      }

      const isSameModel = arePrebuiltModelPresetsEqual(productsPresets, presetProducts);
      if (!options?.skipCompatibilityPrompt && !isSameModel) {
        const compatibility = resolvePrebuiltModelCountertopCompatibility({
          rules: countertopRules,
          presetProducts,
          activeMaterialTokens: activeCountertopMaterialTokens,
          activeCountertopStyle: countertopStyle,
          activeBasinStyle: selectedCountertopSinkType ?? null,
          activeThickness: countertopThickness,
          profile: activeProfileRef.current,
        });

        if (!compatibility.isCompatible) {
          const modelTitle = presets.find((preset) => preset.id === presetId)?.title ?? "Selected model";
          setPendingModelSelection({
            presetProducts,
            presetId,
            modelTitle,
            reason: compatibility.reason,
          });
          return;
        }
      }

      await applyPresetSelection(presetProducts, presetId, {
        ...options,
        preserveCountertopSelections: true,
      });
    },
    [
      activeCountertopMaterialTokens,
      applyPresetSelection,
      countertopRules,
      countertopThickness,
      countertopStyle,
      presets,
      productsPresets,
      selectedCountertopSinkType,
    ],
  );

  const rehydrateCountertopFromPresets = (presetProducts: PresetProduct[]) => {
    const color = presetProducts.find(
      (p) => typeof p.CountertopColor === "string" && p.CountertopColor,
    )?.CountertopColor;
    const sinkType = presetProducts.find((p) => typeof p.sinkType === "string" && p.sinkType)?.sinkType;

    record({
      ...(color ? { CountertopColor: color } : {}),
      ...(sinkType ? { sinkType, CountertopStyle: inferCountertopStyleFromSinkType(sinkType) } : {}),
    });
    if (color) dispatch(setCountertopColorSku(resolveCountertopSkuForSelection(color, sinkType)));
  };

  const handleCustomizePreset = async (presetProducts?: PresetProduct[]) => {
    if (!presetProducts?.length) return;

    trackModularCustomizeClick({
      cta_location: "prebuilt_model_selection",
      configurator_flow: "prebuilt",
      model_count: presetProducts.length,
    });

    // Custom starts from the preset's products alone: the scene is cleared with its add-ons.
    const cleared = await composition.clear({ resetAddOns: true });
    if (cleared.status === "error") console.warn("[Prebuilt] The scene was not cleared", cleared);

    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());
    dispatch(addProductPreset(presetProducts));
    rehydrateCountertopFromPresets(presetProducts);
    navigate(ROUTES.CUSTOM);
  };

  const enterCustomMode = useCallback(async (targetRoute: string = ROUTES.CUSTOM) => {
    // Sync HandleGrooveColor from the scene to slice before navigating. In
    // prebuilt the groove color may exist only on the PlayCanvas products and
    // not in productOptions; the cabinet-builder bootstrap then falls back to
    // cabinetColor, losing the real value. Pre-populating the slice ensures
    // bootstrap uses the scene's groove color.
    const orderedIds = getOrderedProductIds();
    for (const productId of orderedIds) {
      const config = await getConfig(productId);
      const sceneGroove =
        config && typeof config === "object" ? (config as Record<string, unknown>).HandleGrooveColor : undefined;
      if (typeof sceneGroove === "string" && sceneGroove.trim()) {
        record({ HandleGrooveColor: sceneGroove });
        break;
      }
    }

    // We need to reset the store before navigation because it registers
    // productIds in the store, applies placedCabinetStyles, selectedProductConfig,
    // dimensions and activeCabinetType — so products become deletable and newly
    // added cabinets inherit current colors — without wiping scene extras
    // (side panels, towel bar).
    navigate(targetRoute);
  }, [navigate, record]);

  // "Create Your Own" starts Custom from an empty scene, without the preset's add-ons.
  const handleCreateOwnComposition = useCallback(async () => {
    const cleared = await composition.clear({ resetAddOns: true });
    if (cleared.status === "error") console.warn("[Prebuilt] The scene was not cleared", cleared);
    dispatch(resetPrebuiltProducts());
  }, [composition, dispatch]);

  const handleNavigate = useCallback(
    (tab: "prebuilt" | "custom") => {
      if (tab !== "custom") return;

      void enterCustomMode();
    },
    [enterCustomMode],
  );

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialEnterCustomMode(({ route }) => {
        void enterCustomMode(route);
      }),
    [enterCustomMode],
  );

  const setModelRestrictionPopupOpen = useCallback((isOpening: boolean) => {
    if (!isOpening) {
      setPendingModelSelection(null);
    }
  }, []);

  const handleConfirmModelRestriction = useCallback(() => {
    if (!pendingModelSelection) return;

    const selection = pendingModelSelection;
    setPendingModelSelection(null);
    void applyPresetSelection(selection.presetProducts, selection.presetId, {
      preserveCountertopSelections: false,
    });
  }, [applyPresetSelection, pendingModelSelection]);

  const canvasReady = usePlayCanvasReady();

  // Records a saved configuration the restore has already rebuilt in the scene (C09). Loading,
  // checks, the scene and the history belong to the orchestrator in features/configurationRestore.
  const applyPrebuiltRestore = useCallback(
    async (plan: RestorePlan, matches: SceneRestoreMatch[]) => {
      try {
        applySwatchOrderFromMetadata(plan.metadata, dispatch);

        const configuration = plan.configuration;
        const productConfigIds = matches.map(({ sourceId }) => sourceId);
        const sceneIds = matches.map(({ runtimeId }) => runtimeId);
        const presetProducts = buildPresetFromConfiguration(configuration, productConfigIds);
        if (!presetProducts.length) return;

        const uiStateValues = plan.uiState;

        const restoredCountertopColor =
          (typeof uiStateValues?.CountertopColor === "string" && uiStateValues.CountertopColor) || undefined;
        const restoredCountertopColorSku =
          (typeof uiStateValues?.CountertopColorSku === "string" && uiStateValues.CountertopColorSku) || undefined;
        const restoredFaucetHolesAmount =
          (typeof uiStateValues?.FaucetHolesAmount === "string" && uiStateValues.FaucetHolesAmount) || undefined;
        const restoredFaucetHolesSpacing =
          typeof uiStateValues?.FaucetHolesSpacing === "string"
            ? (uiStateValues.FaucetHolesSpacing as string)
            : undefined;
        const restoredSinkType = (typeof uiStateValues?.sinkType === "string" && uiStateValues.sinkType) || undefined;
        const restoredVesselColor =
          typeof uiStateValues?.VesselColor === "string" ? (uiStateValues.VesselColor as string) : undefined;
        const restoredBookMatching =
          typeof uiStateValues?.BookMatching === "string" ? (uiStateValues.BookMatching as string) : undefined;
        const globalConfig = resolveCompatibleCountertopSceneConfig(
          {
            ...resolvePresetSceneDefaults(presetProducts),
            ...(restoredCountertopColor ? { CountertopColor: restoredCountertopColor } : {}),
            ...(restoredSinkType ? { sinkType: restoredSinkType } : {}),
            ...(restoredVesselColor ? { VesselColor: restoredVesselColor } : {}),
          },
          presetProducts,
        );

        // The restorer placed the saved configs as they are. The configuration's countertop and basin
        // are shown on them again, as placing the preset does.
        const replayed = await replay({
          send: {
            ...countertopValuesAfterPlacement(globalConfig),
            ...(restoredVesselColor !== undefined
              ? { VesselColor: restoredVesselColor }
              : toConfigurationValues({ VesselColor: globalConfig.VesselColor })),
          },
          record: false,
        });
        if (replayed.status !== "applied" || replayed.skipped.length > 0) {
          console.warn("[Prebuilt] The restored values did not all reach the scene", replayed);
        }

        // Rebuild presets from real scene configs to keep SKU-driving fields
        // (name/drawers/handle/dimensions) consistent after restore.
        const restoredDividersByCabinet = sceneIds.map((sceneId, index) => {
          const sourceId = productConfigIds[index];
          const sourceConfig = sourceId ? configuration[sourceId] : null;

          return {
            cabinetId: sceneId,
            zones: pickDividerConfigPatch(sourceConfig),
            dividers: collectPlacedDividersFromConfig(sceneId, sourceConfig),
          };
        });
        await applyDividerZones(
          restoredDividersByCabinet.map(({ cabinetId, zones }) => ({ runtimeId: cabinetId, zones })),
        );
        const sceneConfigs = await Promise.all(sceneIds.map((id) => getConfig(id)));
        const sceneConfiguration = sceneIds.reduce<Record<string, unknown>>((acc, id, index) => {
          acc[id] = sceneConfigs[index];
          return acc;
        }, {});
        const scenePresets = buildPresetFromConfiguration(sceneConfiguration, sceneIds);
        const effectivePresets = scenePresets.length ? scenePresets : presetProducts;
        dispatch(reset());
        dispatch(resetCabinetBuilderBootstrap());
        dispatch(addProductPreset(effectivePresets));
        // The restorer placed these products; they are recorded as the scene holds them.
        await composition.adopt({ runtimeIds: sceneIds, products: toCompositionProducts(effectivePresets) });
        restoredDividersByCabinet.forEach(({ cabinetId, dividers }) => {
          dispatch(replacePlacedDividersForCabinet({ cabinetId, dividers }));
        });

        // Options not carried by the rebuilt presets — summary and the sidebar read
        // these from the store, so they are recorded from the saved ui state.
        const restoredCabinetColor =
          typeof uiStateValues?.CabinetColor === "string" ? (uiStateValues.CabinetColor as string) : undefined;
        const restoredHandleGrooveColor =
          typeof uiStateValues?.HandleGrooveColor === "string"
            ? (uiStateValues.HandleGrooveColor as string)
            : undefined;
        const restoredThickness =
          typeof uiStateValues?.Thickness === "string" ? (uiStateValues.Thickness as string) : undefined;
        record({
          ...toConfigurationValues({
            CountertopColor: globalConfig.CountertopColor,
            sinkType: globalConfig.sinkType,
            CountertopStyle: globalConfig.CountertopStyle,
          }),
          ...(restoredFaucetHolesAmount ? { FaucetHolesAmount: restoredFaucetHolesAmount } : {}),
          ...(restoredFaucetHolesSpacing !== undefined ? { FaucetHolesSpacing: restoredFaucetHolesSpacing } : {}),
          ...(restoredVesselColor !== undefined ? { VesselColor: restoredVesselColor } : {}),
          ...(restoredBookMatching !== undefined ? { BookMatching: restoredBookMatching } : {}),
          ...(restoredCabinetColor ? { CabinetColor: restoredCabinetColor } : {}),
          ...(restoredHandleGrooveColor ? { HandleGrooveColor: restoredHandleGrooveColor } : {}),
          ...(restoredThickness ? { Thickness: restoredThickness } : {}),
        });
        if (globalConfig.CountertopColor) {
          if (restoredCountertopColorSku) {
            dispatch(setCountertopColorSku(restoredCountertopColorSku));
          } else {
            const sku = findCountertopSkuByColorName(configuratorGroups, globalConfig.CountertopColor as string);
            if (sku) dispatch(setCountertopColorSku(sku));
          }
        } else if (restoredCountertopColorSku) {
          dispatch(setCountertopColorSku(restoredCountertopColorSku));
        }
        await updateSelectedDimensionsFromScene(effectivePresets, sceneIds);

        // Presets carry no side-panel data; restore the saved groove AND per-side state
        // so a single-side selection isn't expanded to both sides (reapplySidePanelsForPreset
        // is a both-edges "fresh start"). Mirrors CabinetBuilderPage.
        const restoredSidePanels =
          typeof uiStateValues?.SidePanels === "string" ? (uiStateValues.SidePanels as string) : undefined;
        const restoredSidePanelLeft =
          typeof uiStateValues?.SidePanelLeft === "string" ? (uiStateValues.SidePanelLeft as string) : undefined;
        const restoredSidePanelRight =
          typeof uiStateValues?.SidePanelRight === "string" ? (uiStateValues.SidePanelRight as string) : undefined;
        if (restoredSidePanels && isGrooveType(restoredSidePanels) && effectivePresets.length) {
          const leftStatus = (restoredSidePanelLeft ?? "active") as SidePanelStatus;
          const rightStatus = (restoredSidePanelRight ?? "active") as SidePanelStatus;
          await restoreSidePanelState(
            dispatch,
            restoredSidePanels,
            restoredSidePanelLeft,
            restoredSidePanelRight,
            effectivePresets.length,
            { panels: restoredSidePanels, left: leftStatus, right: rightStatus },
          );
          await enforceSidePanelEligibility(
            dispatch,
            activeProfileRef.current,
            restoredSidePanels,
            leftStatus,
            rightStatus,
            effectivePresets.length,
          );
        }

        sessionStorage.setItem("prebuiltModelInitialized", "1");
      } catch (error) {
        console.error("[Prebuilt] Failed to restore configuration", error);
        // The orchestrator reports a restore whose page step failed as partial.
        throw error;
      }
    },
    [
      configuratorGroups,
      composition,
      dispatch,
      record,
      replay,
      resolveCompatibleCountertopSceneConfig,
      updateSelectedDimensionsFromScene,
    ],
  );

  // A configuration opened by id replaces the default preset: the preset effect below must not run over it.
  useEffect(() => {
    if (configIdFromUrl) isDefinedProductsRef.current = true;
  }, [configIdFromUrl]);

  useRestoreSavedConfiguration({ configId: configIdFromUrl, applyPage: applyPrebuiltRestore });

  useEffect(() => {
    const hasInitialized = sessionStorage.getItem("prebuiltModelInitialized") === "1";

    if (!canvasReady || isDefinedProductsRef.current) return;
    if (configIdFromUrl) return;
    if (hasInitialized && productsPresets.length && !presetFromUrl) return;

    isDefinedProductsRef.current = true;

    const presetProducts =
      presetFromUrl?.presetProducts ?? (productsPresets.length ? productsPresets : (defaultPreset?.presetProducts ?? []));

    const run = async () => {
      try {
        const effectivePresetProducts = mergePrebuiltModelTransferableOverrides(presetProducts, transferableOverrides);
        const globalConfig = resolveCompatibleCountertopSceneConfig(
          {
            ...resolvePresetSceneDefaults(effectivePresetProducts),
            ...resolveColorSceneOverrides(),
            ...resolveCountertopSceneOverrides(),
          },
          effectivePresetProducts,
        );
        const placed = await composition.applyPreset({
          products: toCompositionProducts(effectivePresetProducts),
          shared: toConfigurationValues(globalConfig),
          afterPlacement: countertopValuesAfterPlacement(globalConfig),
        });
        if (placed.status === "error") {
          // Nothing was placed: a later run of this effect may try again.
          isDefinedProductsRef.current = false;
          console.warn("[Prebuilt] The preset was not placed", placed);
          return;
        }

        if (!productsPresets.length) {
          dispatch(addProductPreset(effectivePresetProducts));
          syncCountertopSelectionFromSceneConfig(globalConfig);
        }

        await updateSelectedDimensionsFromScene(effectivePresetProducts, placed.productIds);
        sessionStorage.setItem("prebuiltModelInitialized", "1");

        const presetCabinetColor = effectivePresetProducts.find(
          (p) => typeof p.CabinetColor === "string" && p.CabinetColor,
        )?.CabinetColor;
        if (presetCabinetColor) record({ CabinetColor: presetCabinetColor });

        dispatch(clearHistory());
      } catch (error) {
        console.log(error);
      }
    };
    run();
  }, [
    canvasReady,
    composition,
    configIdFromUrl,
    configuratorGroups,
    record,
    defaultPreset,
    dispatch,
    presetFromUrl,
    productsPresets,
    resolveCompatibleCountertopSceneConfig,
    resolveColorSceneOverrides,
    resolveCountertopSceneOverrides,
    syncCountertopSelectionFromSceneConfig,
    transferableOverrides,
    updateSelectedDimensionsFromScene,
  ]);

  useEffect(() => {
    if (isDetail) return;

    const container = getStepContentContainer();
    if (!container) return;

    if (sessionStorage.getItem(modelScrollRestoreFlagKey) !== "1") return;

    const storedTop = Number(sessionStorage.getItem(modelScrollPositionKey));
    if (!Number.isFinite(storedTop)) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTop = storedTop;
      });
    });

    sessionStorage.removeItem(modelScrollRestoreFlagKey);
  }, [getStepContentContainer, isDetail]);

  useLayoutEffect(() => {
    if (!isDetail) return;

    const container = getStepContentContainer();
    if (!container) return;

    container.scrollTop = 0;
  }, [detailModelId, getStepContentContainer, isDetail]);

  const clearAllFilters = () => {
    setSizeFilter("all");
    setStyleFilter("all");
  };

  return (
    <div ref={rootRef}>
      {!isDetail && (
        <>
          <ModeSwitcher
            onClick={handleNavigate}
            dataTargets={{
              root: INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.modelModeSwitcher,
              custom: INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.createYourOwnMode,
            }}
          />

          <div data-tutorial-target={INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.prebuiltModelsGrid}>
            <FilterRow className={s.filterRow}>
              <FilterItem
                label="Size"
                value={sizeFilter === "all" ? undefined : sizeFilter}
                options={[
                  { label: "All", value: "all" },
                  { label: "24–29″", value: "24_29" },
                  { label: "30–39″", value: "30_39" },
                  { label: "40–49″", value: "40_49" },
                  { label: "50–59″", value: "50_59" },
                  { label: "60–69″", value: "60_69" },
                  { label: "70–79″", value: "70_79" },
                  { label: "80–89″", value: "80_89" },
                  { label: "90″+", value: "90_plus" },
                ]}
                onSelect={handleSizeFilter}
              />

              <FilterItem
                label="Style"
                value={styleFilter === "all" ? undefined : styleFilter}
                options={[
                  { label: "All", value: "all" },
                  { label: "1 Drawer", value: "1_drawer" },
                  { label: "2 Drawer", value: "2_drawer" },
                  { label: "Single Basin", value: "single_basin" },
                  { label: "Double Basin", value: "double_basin" },
                  { label: "Asymmetrical", value: "asymmetrical" },
                  { label: "Open Shelving", value: "open_shelving" },
                  { label: "Multi-level", value: "multi_level" },
                ]}
                onSelect={handleStyleFilter}
              />

              {(sizeFilter !== "all" || styleFilter !== "all") && (
                <BaseButton variant="filterBtn" onClick={clearAllFilters}>
                  Clear All
                </BaseButton>
              )}
            </FilterRow>

            <ProductModelsGrid
              data={filteredData}
              handleAddPreset={handleAddPreset}
              handleCustomizePreset={handleCustomizePreset}
              createModelBtn={<CreateModelBtn onCreate={handleCreateOwnComposition} />}
              activePresetId={activePresetId}
              emptyMessage={`No preset compositions available for ${
                activeCollection.manifest.label
              }`}
            />
          </div>
        </>
      )}

      <Outlet />

      <AttentionPopup
        isOpening={pendingModelSelection !== null}
        setIsOpening={setModelRestrictionPopupOpen}
        onConfirm={handleConfirmModelRestriction}
        title="Model Compatibility Restriction"
        content={
          <p>
            Model "{pendingModelSelection?.modelTitle ?? "Selected model"}" is not compatible with your current
            countertop selections. Selecting this model will clear those selections.
            {pendingModelSelection?.reason ? ` ${pendingModelSelection.reason}` : ""}
          </p>
        }
        confirmLabel="Confirm"
      />
    </div>
  );
};
