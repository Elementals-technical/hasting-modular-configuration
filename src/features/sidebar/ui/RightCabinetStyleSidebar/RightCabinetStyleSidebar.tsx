import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import {
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS,
  subscribeToInteractiveConfiguratorTutorialActiveStepChange,
} from "@/features/interactiveConfiguratorTutorial";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import { BaseButton } from "@/shared/ui/Buttons/BaseButton";
import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import image from "../../../../shared/assets/images/png/img_png.png";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { cmToInches, getCountertopMaterialTokensBySku } from "@/shared/lib/sku";
import { getIsActiveStyleSidebar } from "../../model/store/selectors";
import { setOpenStyleSidebar, setPlacementButtonsVisible } from "../../model/store/slice";
import {
  getDimensionOptions,
  getDrawerProduct,
  getCabinetBuilderProductConfig,
  getCountertopColorSku,
  getCountertopStyle,
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getActiveCabinetRule,
  getCabinetCatalog,
  getHeightChoices,
  getSelectedDimensions,
  getSelectedProducts,
  getSelectedSceneProduct,
  getSelectedProductConfig,
  getHeightLocked,
  getSinkType,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import {
  setHasBootstrappedCabinetBuilder,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

import s from "./RightCabinetStyleSidebar.module.scss";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setVisibleButtons, type VisibleButtonsOptions } from "@/utils/functions/playcanvas/setVisibleButtons";
import { reportSceneRefusal } from "@/features/sceneRefusalNotice";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { showEmptyButton } from "@/utils/functions/playcanvas/emptyButton";
import { setScenePlusFilter, type ScenePlusKind } from "@/utils/functions/playcanvas/sceneBridge";
import { getSelectTool } from "@/utils/functions/playcanvas/getSelectTool";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";
import { useHistoryStep } from "@/entities/history/lib/useHistoryStep";
import { getConfiguratorGroupKind } from "@/entities/configurator/lib/configuratorGroupKind";
import { autoRemoveSide as spAutoRemoveSide } from "@/features/sidePanel";
import { selectSteppedCabinetIds } from "@/entities/product/model/store/steppedCabinets";
import { isSteppedDrawers } from "@/shared/config/configurator/typeCabinetCatalog";
import {
  normalizeOptionValue,
  resolveCabinetTypeOfRuntimeId,
  selectEffectiveFallback,
  selectOptions,
  useActiveCollection,
  type StyleSidebarFieldId,
} from "@/entities/collection";
import { useOptionImages } from "@/features/collectionCustomization";
import {
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getCabinetDimensionsByRuntimeId,
  getCabinetEntries,
  getStableKeyForRuntimeId,
} from "@/entities/configuration/model/store/selectors";
import { useChangeAttribute, usePerCabinetAttributeFields } from "@/features/configurationCommands";
import type { AttributeChange, ChangePreview, ChangeResult } from "@/features/configurationCommands";
import {
  filterDepthValuesByCountertopRules,
  filterWidthValuesByCountertopRules,
  resolveMaxAddableCabinetWidthCm,
  useCountertopLengthGuard,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import {
  findPlacedCabinetRule,
  isLeavingSideShelfHandle,
  REASON_HANDLE_HEIGHT_LOCKED,
} from "@/features/configurator-rule-core/cabinetBuilder";
import { cmToInchLabel } from "@/shared/lib/cmToInchLabel";

import { buildAddedCabinetRequest } from "../../lib/buildAddedCabinetRequest";
import { plusFilterFor, rowEndSideOf } from "../../lib/plusPlacement";
import { isDragDropCollection } from "@/features/cabinetPlacementDebug/lib/resolveCabinetDebugSelection";
import { resolveStyleSidebarFields } from "../../lib/resolveStyleSidebarFields";

interface RightCabinetStyleSidebarProps {
  onProductAdded?: () => void;
}

const JOYRIDE_FLOATER_SELECTOR = ".react-joyride__floater";
const STYLE_SIDEBAR_LOCKED_TUTORIAL_STEP_IDS: ReadonlySet<string> = new Set([
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customSizingHandle,
  INTERACTIVE_CONFIGURATOR_TUTORIAL_STEP_IDS.customPlaceCabinet,
]);

interface PendingOssHandleChange {
  next: string;
  ossIds: string[];
}

interface PendingDepthChange {
  next: number;
  previous: number | null;
}

export const RightCabinetStyleSidebar = ({ onProductAdded }: RightCabinetStyleSidebarProps) => {
  const dispatch = useAppDispatch();
  const activeProfile = useAppSelector(getActiveProductProfile);
  const runtimeBindings = useAppSelector(getActiveRuntimeBindings);
  const optionImages = useOptionImages();
  const isOpenedStyleSidebar = useAppSelector(getIsActiveStyleSidebar);
  const isPlayCanvasReady = usePlayCanvasReady();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const placementButtonsVisibleRef = useRef(false);

  const dimensionOptions = useAppSelector(getDimensionOptions);
  const heightChoices = useAppSelector(getHeightChoices);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeDrawerProduct = useAppSelector(getDrawerProduct);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const productConfig = useAppSelector(getCabinetBuilderProductConfig);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const steppedCabinetIds = useAppSelector(selectSteppedCabinetIds);
  // The style being added stands at a height of its own (the Urban Freestanding Short-Cabinet).
  const selectedDrawers =
    typeof selectedProductConfig?.Drawers === "string"
      ? (normalizeOptionValue(activeProfile, "Drawers", selectedProductConfig.Drawers) ?? null)
      : null;
  const isSteppedStyle = isSteppedDrawers(activeCabinetRule, selectedDrawers);
  const heightLocked = useAppSelector(getHeightLocked);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const sinkType = useAppSelector(getSinkType);
  const vesselColor = useAppSelector(getVesselColor);
  const lengthGuard = useCountertopLengthGuard(selectedProducts, selectedDimensions.width ?? null);
  const sceneTotalWidth = lengthGuard.currentWithSp;
  const maxCountertopLength = lengthGuard.max;

  const { run: runStep } = useHistoryStep();
  // A collection with Drag & Drop also places cabinets at the places the scene offers (columns).
  const placesInColumns = useActiveCollection((collection) => isDragDropCollection(collection.id));
  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
  const styleSidebarFields = resolveStyleSidebarFields(
    useActiveCollection((collection) => collection.catalog.customization ?? null),
  );
  // Cabinet values the collection offers for one cabinet alone (`styleSidebar.attributes`).
  const cabinetAttributeIds = useActiveCollection(
    (collection) => collection.catalog.customization?.styleSidebar?.attributes,
  );
  // The drawer cabinet selected in the scene: the sidebar shows its own values and changes them
  // for it alone. Without one the values are the choice for the cabinet being added.
  const selectedCabinetId = useAppSelector((state) => {
    const runtimeId = getSelectedSceneProduct(state);
    if (!runtimeId) return null;

    const rule = findPlacedCabinetRule(getCabinetCatalog(state), runtimeId);
    return rule && !rule.isOpen ? getStableKeyForRuntimeId(state, runtimeId) : null;
  });
  const cabinetAttributeFields = usePerCabinetAttributeFields(
    cabinetAttributeIds,
    selectedCabinetId,
    selectedProductConfig,
  );
  const handlesDisabled = Boolean(activeCabinetRule?.isOpen) || dimensionOptions.handles.length === 0;
  const [pendingHandlePreview, setPendingHandlePreview] = useState<ChangePreview | null>(null);
  const [pendingOssHandleChange, setPendingOssHandleChange] = useState<PendingOssHandleChange | null>(null);
  const [pendingDepthChange, setPendingDepthChange] = useState<PendingDepthChange | null>(null);
  const [handleLockNotice, setHandleLockNotice] = useState<string | null>(null);
  const [isStyleSidebarTutorialStepActive, setIsStyleSidebarTutorialStepActive] = useState(false);
  const {
    change: changeAttributeValue,
    changeDimension,
    confirm: confirmAttributeValue,
    evaluate: evaluateAttributeChange,
    getState: getCommandState,
    composition,
  } = useChangeAttribute();
  /** Height the command service is applying; the dimensions effect must not send it again. */
  const commandHeightRef = useRef<number | null>(null);
  /** A height change is on its way to the scene; a second one waits for the next click. */
  const heightChangeInFlightRef = useRef(false);
  const hasModalOpen =
    pendingHandlePreview !== null ||
    pendingOssHandleChange !== null ||
    pendingDepthChange !== null ||
    handleLockNotice !== null;

  const handleOptions = useMemo(
    () =>
      dimensionOptions.handles?.length
        ? dimensionOptions.handles
        : handlesDisabled
          ? []
          : // Fallback before the rules produced availability: the catalog of the active
            // collection, never a local list of handle ids.
            selectOptions(activeProfile, "Handle").map((option) => ({
              label: option.label,
              value: option.value,
            })),
    [dimensionOptions.handles, handlesDisabled, activeProfile],
  );

  // The picture of a handle is the collection's; an id it declares none for falls back to the
  // generic image instead of gating behaviour, so a new handle renders without a change here.
  const handleImage = useMemo(() => {
    const value = selectedProductConfig?.Handle;
    return (typeof value === "string" ? optionImages?.Handle?.[value] : undefined) ?? image;
  }, [optionImages, selectedProductConfig?.Handle]);

  useEffect(
    () =>
      subscribeToInteractiveConfiguratorTutorialActiveStepChange(({ stepId }) => {
        setIsStyleSidebarTutorialStepActive(
          stepId !== null && STYLE_SIDEBAR_LOCKED_TUTORIAL_STEP_IDS.has(stepId),
        );
      }),
    [],
  );

  const normalizeMaterialLabel = (value: string) => {
    const parts = value
      .split(":")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : value;
  };

  const toOptionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

  const toStringArrayFromCsv = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  };

  const countertopOptionsFromApi = useMemo(() => {
    const groups = configuratorGroups.filter((group) => getConfiguratorGroupKind(group.proxyName) === "countertop");
    if (!groups.length) return [];

    const buildMaterialTokens = (name: string, metaMaterial?: string, extraTokens: string[] = []) => {
      const tokens = new Set<string>();
      if (metaMaterial) {
        toStringArrayFromCsv(metaMaterial).forEach((token) => tokens.add(token));
      }
      if (name) tokens.add(name);
      extraTokens.forEach((token) => {
        if (token) tokens.add(token);
      });

      const parts = name
        .split(":")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) tokens.add(parts[parts.length - 1]);
      return Array.from(tokens);
    };

    return groups.flatMap((group) => {
      const options = (group.options as Array<Record<string, unknown>> | undefined) ?? [];
      return options.flatMap((option) => {
        const variants = (option.variants as Array<Record<string, unknown>> | undefined) ?? [];
        return variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const variantMeta =
              typeof variant.metadata === "object" && variant.metadata
                ? (variant.metadata as Record<string, unknown>)
                : ({} as Record<string, unknown>);
            const nestedMeta =
              typeof variantMeta.metadata === "object" && variantMeta.metadata
                ? (variantMeta.metadata as Record<string, unknown>)
                : ({} as Record<string, unknown>);

            const pick = (...values: unknown[]): string | undefined => {
              for (const value of values) {
                const str = toOptionalString(value);
                if (str) return str;
              }
              return undefined;
            };

            const metaMaterial = pick(nestedMeta.Material, variantMeta.Material);
            const descSource = String(option.name ?? group.proxyName ?? variant.name ?? "");

            return {
              name: String(variant.name ?? ""),
              title: pick(variantMeta.label, variantMeta.Label, nestedMeta.label, nestedMeta.Label, variant.name) ?? "",
              desc: normalizeMaterialLabel(descSource),
              metadata: {
                sku: pick(variantMeta.sku),
                value: pick(variantMeta.value, nestedMeta.value, variant.name) ?? String(variant.name ?? ""),
                materials: buildMaterialTokens(
                  String(option.name ?? variant.name ?? ""),
                  metaMaterial,
                  typeof group.proxyName === "string" ? [group.proxyName] : [],
                ),
              },
            };
          });
      });
    });
  }, [configuratorGroups]);

  const activeMaterialTokens = useMemo(() => {
    if (!countertopColor) return [];
    const match = countertopOptionsFromApi.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      if (candidate !== countertopColor) return false;

      const optionSku = option.metadata?.sku?.trim();
      return !countertopColorSku || !optionSku || optionSku === countertopColorSku;
    });
    return match?.metadata?.materials ?? getCountertopMaterialTokensBySku(countertopColorSku);
  }, [countertopColor, countertopColorSku, countertopOptionsFromApi]);

  const countertopRules = useCountertopRules();
  const maxAddableCabinetWidth = useMemo(
    () =>
      resolveMaxAddableCabinetWidthCm({
        maxCm: maxCountertopLength,
        currentTotalCm: sceneTotalWidth,
      }),
    [maxCountertopLength, sceneTotalWidth],
  );

  const widthOptions = useMemo(() => {
    const values = dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value);
    const filteredValues = filterWidthValuesByCountertopRules({
      profile: activeProfile,
      values,
      activeCabinetCode: activeCabinetRule?.code,
      isSinkBaseCabinet: activeDrawerProduct?.toLowerCase().includes("sink-base"),
      activeCabinetIsOpen: Boolean(activeCabinetRule?.isOpen),
      activeMaterialTokens,
      rules: countertopRules,
      selectedDepth: selectedDimensions.depth ?? null,
      activeCountertopStyle: countertopStyle ?? null,
      activeBasinStyle: sinkType ?? null,
      activeThickness: countertopThickness ?? null,
    });
    const maxAddableWidth = selectedProducts.length ? maxAddableCabinetWidth : null;

    return dimensionOptions.width.filter((option) => {
      if (option.disabled) return false;
      if (!filteredValues.includes(option.value)) return false;
      if (maxAddableWidth === null) return true;
      const numericWidth = Number(option.value);
      if (!Number.isFinite(numericWidth)) return false;
      return numericWidth <= maxAddableWidth + 0.01;
    });
  }, [
    activeProfile,
    activeCabinetRule?.code,
    activeDrawerProduct,
    activeMaterialTokens,
    countertopRules,
    dimensionOptions.width,
    maxAddableCabinetWidth,
    selectedDimensions.depth,
    activeCabinetRule?.isOpen,
    countertopStyle,
    sinkType,
    countertopThickness,
    selectedProducts.length,
  ]);

  const depthOptions = useMemo(() => {
    const values = dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value);
    const filteredValues = filterDepthValuesByCountertopRules({
      values,
      activeMaterialTokens,
      rules: countertopRules,
      activeCountertopStyle: countertopStyle ?? null,
      activeBasinStyle: sinkType ?? null,
      profile: activeProfile,
    });
    const allowedValues = new Set(filteredValues.map((value) => String(value)));
    return dimensionOptions.depth.filter((option) => !option.disabled && allowedValues.has(String(option.value)));
  }, [activeMaterialTokens, activeProfile, countertopRules, countertopStyle, sinkType, dimensionOptions.depth]);

  const widthDisplayOptions = useMemo(
    () =>
      widthOptions.map((option) => ({
        ...option,
        label: cmToInchLabel(Number(option.value)),
      })),
    [widthOptions],
  );

  const depthDisplayOptions = useMemo(
    () =>
      depthOptions.map((option) => ({
        ...option,
        label: cmToInchLabel(Number(option.value)),
      })),
    [depthOptions],
  );

  const heightDisplayOptions = useMemo(
    () => heightChoices.map((height) => ({ name: height, value: height, label: cmToInchLabel(height) })),
    [heightChoices],
  );

  const handleCloseSidebar = () => {
    if (isStyleSidebarTutorialStepActive) return;

    dispatch(setOpenStyleSidebar(false));
  };

  const handleChangeWidth = (value?: string | number) => {
    if (value === undefined) return;
    dispatch(setSelectedDimensions({ width: Number(value) }));
  };

  const closePendingDepthChange = (isConfirmed = false) => {
    if (!pendingDepthChange) return;

    const { previous, next } = pendingDepthChange;
    setPendingDepthChange(null);

    if (isConfirmed || previous === next) return;

    dispatch(setSelectedDimensions({ depth: previous }));
  };

  const handleChangeDepth = (value?: string | number) => {
    if (value === undefined) return;
    const nextDepth = Number(value);
    const isAllowedDepth = depthOptions.some((option) => {
      const optionValue = Number(option.value);
      return Number.isFinite(optionValue) && Math.abs(optionValue - nextDepth) < 0.01;
    });
    if (!isAllowedDepth) return;

    const previousDepth = selectedDimensions.depth;
    if (previousDepth === nextDepth) return;

    dispatch(setSelectedDimensions({ depth: nextDepth }));

    if (selectedProducts.length > 0) {
      setPendingDepthChange({
        next: nextDepth,
        previous: previousDepth,
      });
    }
  };

  /**
   * The cabinets of a composition share one height. Before any is placed this is the choice
   * for the next cabinet; afterwards the command service resizes them all at once.
   */
  const handleChangeHeight = async (value?: string | number) => {
    if (value === undefined) return;
    const nextHeight = Number(value);
    if (!heightChoices.includes(nextHeight) || selectedDimensions.height === nextHeight) return;

    if (selectedProducts.length === 0) {
      dispatch(setSelectedDimensions({ height: nextHeight }));
      return;
    }

    if (heightChangeInFlightRef.current) return;
    heightChangeInFlightRef.current = true;

    try {
      commandHeightRef.current = nextHeight;

      const result = await runStep(() =>
        changeDimension({ attributeId: "Height", value: nextHeight, scope: "global" }),
      );
      if (result.status !== "applied") {
        commandHeightRef.current = null;
        console.warn("[Sidebar] The height was not changed", result);
      }
    } finally {
      heightChangeInFlightRef.current = false;
    }
  };

  // An open shelf has none of these values; a selected drawer cabinet always has.
  const showsCabinetAttributes =
    selectedCabinetId !== null || (activeCabinetRule !== null && !activeCabinetRule.isOpen);
  /** What a selector shows: the selected cabinet's own value, else the choice for the next cabinet. */
  const shownCabinetAttributeValues = useMemo<Record<string, string>>(
    () =>
      showsCabinetAttributes
        ? Object.fromEntries(
            cabinetAttributeFields.flatMap(({ attributeId, value }) => {
              const chosen = selectedProductConfig?.[attributeId];
              const shown = selectedCabinetId === null && typeof chosen === "string" && chosen ? chosen : value;
              return shown ? [[attributeId, shown]] : [];
            }),
          )
        : {},
    [cabinetAttributeFields, selectedCabinetId, selectedProductConfig, showsCabinetAttributes],
  );

  const handleChangeCabinetAttribute = async (attributeId: string, value?: string | number) => {
    if (value === undefined) return;
    const next = String(value);
    if (shownCabinetAttributeValues[attributeId] === next) return;

    // No cabinet is selected: the value goes with the cabinet being added.
    if (selectedCabinetId === null) {
      dispatch(setSelectedProductConfig({ ...selectedProductConfig, [attributeId]: next }));
      return;
    }

    const runtimeId = getSelectedSceneProduct(getCommandState());

    const result = await runStep(() =>
      changeAttributeValue({
        attributeId,
        value: next,
        scope: "cabinet",
        cabinetId: selectedCabinetId,
        onlyThisCabinet: true,
      }),
    );
    if (result.status !== "applied") {
      console.warn(`[Sidebar] ${attributeId} was not changed`, result);
      return;
    }

    // The scene drops its selection while it rebuilds the cabinet. The cabinet stays selected, so
    // the selectors keep showing its values and not those of a cabinet still to add.
    if (runtimeId) getSelectTool()?.setSelectedByName(runtimeId, { mode: "replace" });
  };

  /** Shows what the command service answered; an applied change needs nothing more. */
  const showHandleChangeResult = (result: ChangeResult) => {
    switch (result.status) {
      case "confirmation-required":
        setPendingHandlePreview(result.preview);
        return;
      case "blocked":
        setHandleLockNotice(result.reason);
        return;
      case "error":
        setHandleLockNotice(result.message);
        return;
      case "partial":
        setHandleLockNotice(
          `The handle was applied, but ${result.failed.map(({ change }) => change.attributeId).join(", ")} could not be updated.`,
        );
        return;
      case "applied":
        return;
    }
  };

  /**
   * A handle change goes through the command service: it checks the rules, asks for
   * confirmation when the profile says so, and sends the agreed set to the scene once.
   * Nothing changes before Confirm, so Cancel has nothing to revert.
   */
  const requestHandleChange = async (handleType: string) => {
    // Read at the moment of the change: removing Side Shelves just before changes the list.
    const cabinetId = getCabinetEntries(getCommandState())[0]?.stableKey;

    // No cabinet placed yet: this is the choice for the next cabinet; there is nothing to send.
    if (!cabinetId) {
      await runStep(async () => {
        dispatch(setSelectedProductConfig({ ...(selectedProductConfig ?? {}), Handle: handleType }));
      });
      return;
    }

    // A change that waits for confirmation takes its undo step when it is confirmed, not before the dialog.
    const request: AttributeChange = { attributeId: "Handle", value: handleType, scope: "cabinet", cabinetId };
    const evaluation = evaluateAttributeChange(request);
    const appliesAtOnce = evaluation.kind === "planned" && evaluation.confirmation.length === 0;
    showHandleChangeResult(
      await (appliesAtOnce ? runStep(() => changeAttributeValue(request)) : changeAttributeValue(request)),
    );
  };

  const closePendingHandlePreview = () => {
    setPendingHandlePreview(null);
  };

  const confirmPendingHandlePreview = async () => {
    if (!pendingHandlePreview) return;
    const preview = pendingHandlePreview;
    setPendingHandlePreview(null);

    const plannedHeight = preview.plan.find(({ attributeId }) => attributeId === "Height")?.value;
    commandHeightRef.current = typeof plannedHeight === "number" ? plannedHeight : null;

    const result = await runStep(() => confirmAttributeValue(preview));

    if (result.status !== "applied" && result.status !== "partial") {
      commandHeightRef.current = null;
    }

    showHandleChangeResult(result);
  };

  const handleSetHandleType = async (handleType: string) => {
    const previousHandle = selectedProductConfig?.Handle as string | undefined;
    // A scene id names the scene type ("UF-open-shelves-side-…"), which need not contain the cabinet type.
    const isSideShelf = (id: string) =>
      resolveCabinetTypeOfRuntimeId(activeProfile, runtimeBindings, id) === "Side-Shelf";

    if (typeof heightLocked === "number") {
      const option = dimensionOptions.handles.find((item) => String(item.value) === handleType);
      if (option?.disabled && option.reasonCode === REASON_HANDLE_HEIGHT_LOCKED) {
        const ossIdsForLock = selectedProducts.filter(isSideShelf);
        const leavingNonGroove = isLeavingSideShelfHandle(activeProfile, previousHandle, handleType);

        if (ossIdsForLock.length > 0 && leavingNonGroove) {
          setPendingOssHandleChange({ next: handleType, ossIds: ossIdsForLock });
          return;
        }

        setHandleLockNotice(
          `A module with only ${heightLocked} cm (${cmToInches(heightLocked)}") height is present (e.g. Side Shelf). While it is on the scene, only handles for ${heightLocked} cm (${cmToInches(heightLocked)}") are available.`,
        );
        return;
      }
    }

    if (previousHandle === handleType) return;

    const isSwitchingAwayFromPto = isLeavingSideShelfHandle(activeProfile, previousHandle, handleType);
    const ossIds = selectedProducts.filter(isSideShelf);
    if (isSwitchingAwayFromPto && ossIds.length > 0) {
      setPendingOssHandleChange({ next: handleType, ossIds });
      return;
    }

    await requestHandleChange(handleType);
  };

  const closePendingOssHandleChange = () => {
    setPendingOssHandleChange(null);
  };

  const confirmPendingOssHandleChange = async () => {
    if (!pendingOssHandleChange) return;
    const { next, ossIds } = pendingOssHandleChange;
    setPendingOssHandleChange(null);

    // The side shelves go through the composition command, which removes them from the scene
    // and records what the scene kept; the handle only changes once they are gone.
    const removed = await composition.removeCabinets(ossIds);
    if (removed.status === "error") {
      console.warn("[Sidebar] The side shelves were not removed", removed);
      return;
    }

    await requestHandleChange(next);
  };

  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (!selectedProducts.length) return;
    if (selectedDimensions.height === null || selectedDimensions.depth === null || selectedDimensions.width === null) {
      return;
    }

    // A height the command service just applied is already in the scene.
    if (commandHeightRef.current !== null && commandHeightRef.current === selectedDimensions.height) {
      commandHeightRef.current = null;
      return;
    }

    // Selecting another cabinet copies its actual size into the selection. That is not a change
    // to send: it would give every cabinet the selected one's height and depth (I04).
    const state = getCommandState();
    const hasSize = (dimensions: ReturnType<typeof getCabinetDimensionsByRuntimeId>) =>
      dimensions?.height === selectedDimensions.height && dimensions?.depth === selectedDimensions.depth;

    if (hasSize(getCabinetDimensionsByRuntimeId(state, getSelectedSceneProduct(state)))) return;

    // Opening the sidebar re-runs this effect; when every cabinet already has this size there is nothing to send.
    // A short cabinet keeps a height of its own (steppedSceneProducts), so it is not asked to have this one.
    const placedCabinets = getCabinetEntries(state).filter(({ runtimeId }) => !steppedCabinetIds.includes(runtimeId));
    if (
      placedCabinets.length > 0 &&
      placedCabinets.every(({ runtimeId }) => hasSize(getCabinetDimensionsByRuntimeId(state, runtimeId)))
    ) {
      return;
    }

    // Send only the size that changed: an unchanged Height sent with a new Depth resizes every
    // cabinet again, and a short cabinet was grown to it for a few frames (visible blinking).
    const differsFromPlaced = (dimension: "height" | "depth") =>
      placedCabinets.some(
        ({ runtimeId }) => getCabinetDimensionsByRuntimeId(state, runtimeId)?.[dimension] !== selectedDimensions[dimension],
      );
    const depthConfig = differsFromPlaced("depth") ? { Depth: selectedDimensions.depth } : {};
    const dimConfig = {
      ...(differsFromPlaced("height") ? { Height: selectedDimensions.height } : {}),
      ...depthConfig,
    };

    // Only short cabinets differ (they keep a height of their own): nothing to send.
    if (Object.keys(dimConfig).length === 0) return;

    setConfigBatch({}, dimConfig);

    // A short cabinet's label keeps its own height (steppedSceneProducts).
    selectedProducts.forEach((id) =>
      updateDimensionDataForProduct(id, steppedCabinetIds.includes(id) ? depthConfig : dimConfig),
    );
  }, [selectedDimensions, selectedProducts, isOpenedStyleSidebar, getCommandState, steppedCabinetIds]);

  useEffect(() => {
    // Only set default Handle if it's completely missing (first time, no previous selection)
    const fallbackHandle = selectEffectiveFallback(activeProfile, "Handle");

    if (!handlesDisabled && fallbackHandle && !selectedProductConfig?.Handle && selectedProductConfig !== null) {
      dispatch(
        setSelectedProductConfig({
          ...selectedProductConfig,
          Handle: fallbackHandle,
        }),
      );
    }
  }, [dispatch, selectedProductConfig, handlesDisabled, activeProfile]);

  // A handle changed by the rules reaches the scene through the handle listener in
  // optionsListener.ts; a user choice goes through the command service above.

  // Show plus buttons when the sidebar is opened.
  useEffect(() => {
    const hasAddableWidth = widthOptions.length > 0;
    // A side shelf and a short cabinet (`ruleData.steppedModules`, placement "composition-end") go
    // at an end of the composition: the scene's "Side-Shelf" button mode shows the end buttons only.
    const placesAtEnd = activeDrawerProduct === "Side-Shelf" || isSteppedStyle;
    const shouldShowPlacementButtons = isOpenedStyleSidebar && hasAddableWidth;

    // The cabinet the "+" would add: the scene keeps only the "+" it may use (UF: a short one never
    // between tall ones) at its height. A short cabinet stands at its own height (table 590).
    const handle = shownCabinetAttributeValues.Handle;
    const steppedHeight =
      isSteppedStyle && selectedDrawers && handle
        ? activeCabinetRule?.steppedHeightByHandle?.[selectedDrawers]?.[handle]
        : undefined;
    const options: VisibleButtonsOptions = {
      ...(placesAtEnd ? { productType: "Side-Shelf" } : {}),
      config: { Height: steppedHeight ?? selectedDimensions.height ?? undefined, Handle: handle },
    };

    setVisibleButtons(shouldShowPlacementButtons, isOpenedStyleSidebar ? options : undefined);
    // A row that holds columns shows only the "+" that fit this cabinet (a shelf never goes in a column).
    setScenePlusFilter(
      shouldShowPlacementButtons
        ? plusFilterFor(
            activeDrawerProduct,
            (id) => resolveCabinetTypeOfRuntimeId(activeProfile, runtimeBindings, id),
            { columns: placesInColumns },
          )
        : null,
    );
    placementButtonsVisibleRef.current = shouldShowPlacementButtons;

    // On an empty scene, setVisibleButtons rebuilds the scene's buttons and leaves the "+" of the
    // first cabinet hidden (SceneManager.updateButtonsPositions → plusManager.showEmptyState).
    // CabinetBuilderPage shows that "+" once when the sidebar opens; this effect re-runs on every
    // change of the cabinet being added, so it shows it again, on the same condition as the page.
    const isEmptyComposition = selectedProducts.length === 0;
    if (isOpenedStyleSidebar && isEmptyComposition) showEmptyButton();
    // The player offers Drag to Place beside them.
    dispatch(setPlacementButtonsVisible(shouldShowPlacementButtons));
  }, [
    activeCabinetRule,
    activeDrawerProduct,
    activeProfile,
    dispatch,
    isOpenedStyleSidebar,
    isSteppedStyle,
    placesInColumns,
    runtimeBindings,
    selectedDimensions.height,
    selectedDrawers,
    selectedProducts.length,
    shownCabinetAttributeValues,
    widthOptions.length,
  ]);

  useEffect(
    () => () => {
      if (!placementButtonsVisibleRef.current) return;
      setVisibleButtons(false);
      setScenePlusFilter(null);
      dispatch(setPlacementButtonsVisible(false));
    },
    [dispatch],
  );

  // Close sidebar when clicking outside of it.
  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (hasModalOpen) return;
    if (isStyleSidebarTutorialStepActive) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!sidebarRef.current) return;

      const target = event.target as Element | null;
      if (target?.closest?.('[data-filter-menu="true"]')) return;
      if (target?.closest?.(JOYRIDE_FLOATER_SELECTOR)) return;

      if (sidebarRef.current.contains(event.target as Node)) return;

      dispatch(setOpenStyleSidebar(false));
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dispatch, hasModalOpen, isOpenedStyleSidebar, isStyleSidebarTutorialStepActive]);

  // Set the product where the "+" stands: a row end, or the free place of a column.
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const onPlusClick = async (entityId: string, side: ScenePlusKind) => {
      console.log("Clicked Plus Button", entityId, side);

      if (!activeDrawerProduct) return;
      const availableAddWidths = filterWidthValuesByCountertopRules({
        profile: activeProfile,
        values: dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value),
        activeCabinetCode: activeCabinetRule?.code,
        isSinkBaseCabinet: activeDrawerProduct?.toLowerCase().includes("sink-base"),
        activeCabinetIsOpen: Boolean(activeCabinetRule?.isOpen),
        activeMaterialTokens,
        rules: countertopRules,
        selectedDepth: selectedDimensions.depth ?? null,
        activeCountertopStyle: countertopStyle ?? null,
        activeBasinStyle: sinkType ?? null,
        activeThickness: countertopThickness ?? null,
      })
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

      // A cabinet under a hanging one does not lengthen the countertop above it.
      const addableWidthLimit = side === "bottom" ? null : maxAddableCabinetWidth;
      const fittingAddWidths =
        addableWidthLimit === null
          ? availableAddWidths
          : availableAddWidths.filter((width) => width <= addableWidthLimit + 0.01);

      if (
        addableWidthLimit !== null &&
        maxCountertopLength !== null &&
        sceneTotalWidth !== null &&
        selectedProducts.length > 0 &&
        !fittingAddWidths.length
      ) {
        console.warn("[RightCabinetStyleSidebar] Add blocked by countertop max length", {
          maxCountertopLength,
          sceneTotalWidth,
          requestedWidth: selectedDimensions.width,
          availableAddWidths,
          fittingAddWidths,
        });
        return;
      }

      const selectedWidthIsFitting =
        typeof selectedDimensions.width === "number" &&
        Number.isFinite(selectedDimensions.width) &&
        (addableWidthLimit === null || selectedDimensions.width <= addableWidthLimit + 0.01);
      const fallbackWidth =
        fittingAddWidths.length > 0
          ? fittingAddWidths.reduce((max, width) => (width > max ? width : max), fittingAddWidths[0])
          : null;
      const widthForAddedCabinet = selectedWidthIsFitting ? selectedDimensions.width : fallbackWidth;

      // The cabinet and the side panel a side shelf takes the place of are one undo step.
      const productId = await runStep(async () => {
        if (activeDrawerProduct === "Side-Shelf") {
          // A side shelf stands at a row end, in the place of that side's panel.
          const rowSide = rowEndSideOf(side);
          if (!rowSide) return null;
          await spAutoRemoveSide(dispatch, rowSide);
        }

        // A short cabinet stays at its end of the composition: a taller one asked for outside it goes
        // inside it. Only a "+" beside a row end is redirected; a column's place is taken as offered.
        const placement =
          side === "left" || side === "right"
            ? resolveSteppedEndPlacement({
                anchorRuntimeId: entityId,
                side,
                orderedRuntimeIds: getOrderedProductIds(selectedProducts).filter((id) => selectedProducts.includes(id)),
                steppedRuntimeIds: steppedCabinetIds,
                addsEndCabinet: isSteppedStyle || activeDrawerProduct === "Side-Shelf",
              })
            : { anchorRuntimeId: entityId, side };

        // The collection's scene product goes beside the clicked one and is recorded there with its
        // drawer style, as a duplicated cabinet is.
        const added = await composition.addCabinet(
          buildAddedCabinetRequest({
            cabinetType: activeDrawerProduct,
            // The cabinet takes the values its selectors show.
            config: productConfig ? { ...productConfig, ...shownCabinetAttributeValues } : productConfig,
            width: widthForAddedCabinet,
            sinkType,
            countertopStyle,
            vesselColor,
            profile: activeProfile,
            anchorRuntimeId: placement.anchorRuntimeId,
            side: placement.side,
          }),
        );
        // A refusal of the scene (UF: a short cabinet between tall ones) is explained to the user.
        reportSceneRefusal(added);
        return added.status === "error" ? null : added.placed[0];
      });
      if (!productId) return;

      dispatch(setHasBootstrappedCabinetBuilder(true));

      // Close sidebar and reset accordion to default state
      dispatch(setOpenStyleSidebar(false));
      if (onProductAdded) {
        onProductAdded();
      }
      // Keep last active cabinet type for downstream UI rules (e.g., side panels).
    };

    setHandleButtonClick(onPlusClick);
  }, [
    activeProfile,
    isPlayCanvasReady,
    activeDrawerProduct,
    composition,
    maxCountertopLength,
    maxAddableCabinetWidth,
    onProductAdded,
    productConfig,
    shownCabinetAttributeValues,
    runStep,
    sceneTotalWidth,
    selectedDimensions.width,
    selectedProducts,
    steppedCabinetIds,
    isSteppedStyle,
    activeCabinetRule?.code,
    activeCabinetRule?.isOpen,
    activeMaterialTokens,
    countertopStyle,
    countertopThickness,
    countertopRules,
    dimensionOptions.width,
    selectedDimensions.depth,
    sinkType,
    dispatch,
    vesselColor,
  ]);

  // The collection's ui.json lists the selectors and their order (`styleSidebar.fields`); one with
  // nothing to choose is left out.
  const selectors: Record<StyleSidebarFieldId, ReactNode> = {
    Width: (
      <div className={s.contentItem} key="Width">
        <div>Width</div>
        <FilterSelection
          label={"Width"}
          options={widthDisplayOptions}
          value={selectedDimensions.width ?? ""}
          hintPlacement="left"
          showHints={false}
          onSelect={(value) => handleChangeWidth(value)}
        />
      </div>
    ),
    Depth: (
      <div className={s.contentItem} key="Depth">
        <div>Depth</div>
        <FilterSelection
          label={"Depth"}
          options={depthDisplayOptions}
          value={selectedDimensions.depth ?? ""}
          hintPlacement="left"
          showHints={false}
          onSelect={(value) => handleChangeDepth(value)}
        />
      </div>
    ),
    Height: heightDisplayOptions.length > 0 && (
      <div className={s.contentItem} key="Height">
        <div>Height</div>
        <FilterSelection
          label={"Height"}
          options={heightDisplayOptions}
          value={selectedDimensions.height ?? ""}
          hintPlacement="left"
          showHints={false}
          onSelect={(value) => handleChangeHeight(value)}
        />
      </div>
    ),
    Handle: !handlesDisabled && (
      <div className={s.contentItem} key="Handle">
        <div>Handle</div>
        <FilterSelection
          label={"Handle"}
          options={handleOptions}
          value={selectedProductConfig?.Handle as string | undefined}
          hintPlacement="left"
          showHints={false}
          onSelect={(value) => {
            if (value === undefined) return;
            handleSetHandleType(String(value));
          }}
          onDisabledSelect={(value) => {
            handleSetHandleType(String(value));
          }}
        />
      </div>
    ),
  };

  return (
    <>
      <PopupCenterContent isOpening={handleLockNotice !== null} onClose={() => setHandleLockNotice(null)}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Handle Change Blocked</div>
            <div className={s.confirmClose} onClick={() => setHandleLockNotice(null)}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>{handleLockNotice}</p>
          </div>
          <div className={s.confirmFooter}>
            <div>
              <BaseButton onClick={() => setHandleLockNotice(null)} fullWidth={true}>
                Ok
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingHandlePreview !== null} onClose={closePendingHandlePreview}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Update Handle Style?</div>
            <div className={s.confirmClose} onClick={closePendingHandlePreview}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>{pendingHandlePreview?.reasons[0]?.reason}</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={closePendingHandlePreview} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void confirmPendingHandlePreview()} fullWidth={true}>
                Confirm
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingOssHandleChange !== null} onClose={closePendingOssHandleChange}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Remove Side Shelf?</div>
            <div className={s.confirmClose} onClick={closePendingOssHandleChange}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>Side Shelf cabinets are only compatible with a PTO handle.</p>
            <p>Switching to another handle will remove all Side Shelf cabinets. Continue?</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={closePendingOssHandleChange} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void confirmPendingOssHandleChange()} fullWidth={true}>
                Approve
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingDepthChange !== null} onClose={() => closePendingDepthChange()}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Depth Updated</div>
            <div className={s.confirmClose} onClick={() => closePendingDepthChange()}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>The cabinet depth has been updated for all cabinets in your design.</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={() => closePendingDepthChange()} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => closePendingDepthChange(true)} fullWidth={true}>
                Confirm
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <div
        ref={sidebarRef}
        className={`${s.cabinetStyleSidebar} ${isOpenedStyleSidebar ? s.active : ""}`}
        data-tutorial-target={INTERACTIVE_CONFIGURATOR_TUTORIAL_TARGETS.customSizingHandle}
      >
        <div className={s.arrow} onClick={handleCloseSidebar}>
          <ArrowRight width="16" />
        </div>
        <div className={s.content}>
          {styleSidebarFields.map((fieldId) => selectors[fieldId])}
          {showsCabinetAttributes &&
            cabinetAttributeFields.map(({ attributeId, label, options }) => (
              <div className={s.contentItem} key={attributeId}>
                <div>{label}</div>
                <FilterSelection
                  label={label}
                  options={options.map((option) => ({ name: option.value, value: option.value, label: option.label }))}
                  value={shownCabinetAttributeValues[attributeId] ?? ""}
                  hintPlacement="left"
                  showHints={false}
                  onSelect={(value) => void handleChangeCabinetAttribute(attributeId, value)}
                />
              </div>
            ))}

          <div className={`${s.bottomText} ${s.mobileBottomText}`}>
            Click <span className={s.plusButtonIcon}> + </span> button to place your cabinet
          </div>

          {!handlesDisabled && (
            <div className={s.image}>
              <img src={handleImage} alt="handle preview" />
            </div>
          )}
        </div>

        <div className={`${s.bottomText} ${s.desktopBottomText}`}>
          Click <span className={s.plusButtonIcon}> + </span> button to place your cabinet
        </div>
      </div>
    </>
  );
};
