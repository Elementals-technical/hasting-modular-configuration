import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { NestedDropdown, type DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  addProductId,
  removeProductId,
  setActiveCabinetType,
  setActiveCountertopThickness,
  setPlacedCabinetStyle,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSelectedSceneProduct,
  swapProductIds,
} from "@/entities/product/model/store/slice";
import { swapProducts } from "@/utils/functions/playcanvas/swapProducts.ts";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight.tsx";
import { getSelectTool } from "@/utils/functions/playcanvas/getSelectTool";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { setProductByParams } from "@/utils/functions/playcanvas/setProductByParams";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import {
  getDimensionOptions,
  getCabinetCatalog,
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getSinkType,
  getSelectedDimensions,
  getIsDrawerOpen,
  getSelectedSceneProduct,
  getSelectedProductConfig,
} from "@/entities/product/model/store/selectors";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { OpenMenuIcon } from "@/shared/assets/images/svg/OpenMenuIcon";
import { DeleteMenuIcon } from "@/shared/assets/images/svg/DeleteMenuIcon";
import { DuplicateIcon } from "@/shared/assets/images/svg/DuplicateIcon";
import { getDropdownPosition } from "@/utils/functions/getDropdownPosition";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { useGetConfiguratorQuery } from "@/entities";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import { buildCountertopRuleState, parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";

// 🔧 UPDATE THIS VERSION WHEN DEPLOYING NEW PLAYCANVAS BUILD
const PLAYCANVAS_VERSION = "028";
const PLAYCANVAS_SRC = `/HastingCabinetsParametrization/index.html?v=${PLAYCANVAS_VERSION}`;

export const PlayCanvasIntegration = () => {
  const containerRef = useRef<HTMLIFrameElement | null>(null);
  const pendingHandleSyncRef = useRef(false);
  const [dropdownState, setDropdownState] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });

  const [countertopPopoverState, setCountertopPopoverState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    entityName: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    entityName: null,
  });

  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const countertopPopoverRef = useRef<HTMLDivElement | null>(null);

  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const isPrebuilt = location.pathname.startsWith("/prebuilt");

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const cabinetCatalog = useAppSelector(getCabinetCatalog);
  const isDrawerOpen = useAppSelector(getIsDrawerOpen);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeCountertopThickness = useAppSelector(getActiveCountertopThickness);
  const activeBasinStyle = useAppSelector(getSinkType);

  const saveSnapshot = useHistorySnapshot();

  const { data: counterTopData } = useGetCountertopDatatableQuery(438);
  const { data: counterTopMaterials } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

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

  const isDrawerCabinet = useMemo(() => {
    const raw =
      (typeof selectedProductConfig?.ProductType === "string" && selectedProductConfig.ProductType) ||
      (typeof selectedProductConfig?.productType === "string" && selectedProductConfig.productType) ||
      (typeof selectedProductConfig?.type === "string" && selectedProductConfig.type) ||
      selectedSceneProduct ||
      "";

    // Strip trailing random suffix (e.g. "Open-Shelf-abc123" → "Open-Shelf")
    const lastDash = raw.lastIndexOf("-");
    const baseType =
      lastDash > 0 && raw.slice(lastDash + 1).length >= 6 ? raw.slice(0, lastDash).toLowerCase() : raw.toLowerCase();

    const openShelfTypes = ["open-shelf", "side-shelf", "os", "oss"];

    return !openShelfTypes.includes(baseType);
  }, [selectedProductConfig, selectedSceneProduct]);

  const handleOptions = useMemo(() => {
    if (dimensionOptions.handles?.length) {
      return dimensionOptions.handles.map((h) => ({
        label: String(h.name ?? h.value),
        value: String(h.value),
        disabled: h.disabled,
      }));
    }

    return [
      { label: "Push to open", value: "handle_pto" },
      { label: "Upper Groove", value: "handle_urban_topcut" },
      { label: "Central Groove", value: "handle_urban_botcut" },
    ];
  }, [dimensionOptions.handles]);

  const getVariantMeta = useCallback(
    (variant: { metadata?: Record<string, unknown>; name: string; image?: string | null }) => {
      const meta = (variant.metadata ?? {}) as Record<string, unknown>;
      const nested =
        typeof meta.metadata === "object" && meta.metadata
          ? (meta.metadata as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const pick = (...values: unknown[]): string | undefined => {
        for (const value of values) {
          const str = toOptionalString(value);
          if (str) return str;
        }
        return undefined;
      };

      return {
        material: pick(nested.Material, meta.Material),
        color: pick(nested.Color, meta.Color),
        look: pick(nested.Look, meta.Look),
        hex: pick(nested.hex, meta.hex),
        image: pick(nested.image, meta.image, variant.image),
        value: pick(meta.value, nested.value, variant.name),
        label: pick(meta.label, meta.Label, nested.label, nested.Label, variant.name),
      };
    },
    [],
  );

  const countertopOptionsFromApi = useMemo(() => {
    const groups = (counterTopMaterials?.availableOptions ?? []).filter((g) => g.proxyName === "Countertop Color");
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

    return groups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = getVariantMeta(variant);
            const metaMaterial = meta.material;
            const metaColor = meta.color;
            const metaLook = meta.look;
            const metaHex = meta.hex;
            const descSource = option.name || group.proxyName || variant.name;

            return {
              id: variant.id,
              title: meta.label ?? variant.name,
              name: variant.name,
              desc: normalizeMaterialLabel(descSource),
              metadata: {
                image: meta.image,
                value: meta.value ?? variant.name,
                sku: toOptionalString((variant.metadata as Record<string, unknown>)?.sku),
                materials: buildMaterialTokens(
                  option.name || variant.name,
                  metaMaterial,
                  group.proxyName ? [group.proxyName] : [],
                ),
                colors: toStringArrayFromCsv(metaColor),
                looks: toStringArrayFromCsv(metaLook),
                hex: metaHex?.trim(),
              },
            };
          }),
      ),
    );
  }, [counterTopMaterials, getVariantMeta]);

  const activeMaterialTokens = useMemo(() => {
    if (!activeCountertopColor) return [];
    const match = countertopOptionsFromApi.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      return candidate === activeCountertopColor;
    });
    return match?.metadata?.materials ?? [];
  }, [activeCountertopColor, countertopOptionsFromApi]);

  const countertopRules = useMemo(() => parseCountertopMatrix(counterTopData), [counterTopData]);

  const ruleState = useMemo(
    () =>
      buildCountertopRuleState({
        rules: countertopRules,
        activeMaterialTokens,
        width: selectedDimensions.width ?? null,
        depth: selectedDimensions.depth ?? null,
        activeBasinStyle,
        activeThickness: activeCountertopThickness ?? null,
      }),
    [
      activeBasinStyle,
      activeCountertopThickness,
      activeMaterialTokens,
      countertopRules,
      selectedDimensions.depth,
      selectedDimensions.width,
    ],
  );

  const thicknessOptions = useMemo(
    () => Array.from(ruleState.allowedThicknesses).sort((a, b) => a - b),
    [ruleState.allowedThicknesses],
  );

  const resolveCabinetTypeId = useCallback(
    (productType: string | null) => {
      if (!productType) return null;

      const normalized = productType.toLowerCase();
      const match = cabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase()));

      return match?.code ?? null;
    },
    [cabinetCatalog.typeCabinetRules],
  );

  const showDropdownForEntity = useCallback((entityName: string) => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    const pos = getDropdownPosition(entityName, iframeEl, lastPointerPosRef.current);
    setDropdownState({ visible: true, x: pos.x, y: pos.y });
  }, []);

  const showCountertopPopoverForEntity = useCallback((entityName: string) => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    const pos = getDropdownPosition(entityName, iframeEl, lastPointerPosRef.current, {
      width: 360,
      height: 320,
    });

    setCountertopPopoverState({ visible: true, x: pos.x, y: pos.y, entityName });
  }, []);

  const closeCountertopPopover = useCallback(() => {
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, []);

  // Track pointer position so we know where the user clicked inside the iframe.
  // We listen on both: postMessage from the iframe (preferred) and mousemove on
  // the parent window (fallback — gives the last known position before the
  // cursor enters the iframe).
  useEffect(() => {
    const iframeEl = containerRef.current;

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "pointer-position") {
        lastPointerPosRef.current = { x: e.data.x, y: e.data.y };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!iframeEl) return;

      const rect = iframeEl.getBoundingClientRect();
      lastPointerPosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  // Bridge PlayCanvas Configurator API
  useEffect(() => {
    (window as any).containerRef = containerRef;
    (window as any).playCanvasReady = false;

    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    let pollId: number | null = null;

    const markReady = () => {
      (window as any).playCanvasReady = true;
      window.dispatchEvent(new Event("playcanvas-ready"));
    };

    const tryBridgeApi = (cw: any) => {
      const api = cw?.ConfiguratorAPI;
      const addProduct = api?.addProduct || cw?.addProduct;
      if (typeof addProduct === "function") {
        cw.addProduct = api?.addProduct ? api.addProduct.bind(api) : addProduct.bind(api || cw);
        markReady();
        return true;
      }
      return false;
    };

    const handleLoad = () => {
      const cw = iframeEl.contentWindow as any;
      if (!cw) return;

      if (tryBridgeApi(cw)) return;

      const startedAt = Date.now();
      const pollInterval = 200;
      const maxWaitMs = 30000;

      pollId = window.setInterval(() => {
        if (tryBridgeApi(cw)) {
          if (pollId !== null) clearInterval(pollId);
          pollId = null;
          return;
        }

        if (Date.now() - startedAt > maxWaitMs) {
          if (pollId !== null) clearInterval(pollId);
          pollId = null;
          console.warn("PlayCanvasIntegration: ConfiguratorAPI.addProduct not available");
        }
      }, pollInterval);
    };

    iframeEl.addEventListener("load", handleLoad);
    return () => {
      iframeEl.removeEventListener("load", handleLoad);
      if (pollId !== null) clearInterval(pollId);
    };
  }, []);

  // useEffect(() => {
  //   if (!playCanvasReady) return;

  //   const tool = getDimensionTool();
  //   tool?.setEnabled(true);
  // }, [playCanvasReady]);

  const productIds = useAppSelector((store) => store.rootStateUI.product.productIds);

  const handleSetWidth = useCallback(
    async (width: number) => {
      if (!selectedSceneProduct) return;

      try {
        await saveSnapshot();
        await setConfig(selectedSceneProduct, { Width: width });

        dispatch(setSelectedDimensions({ width }));
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set width", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [selectedSceneProduct, saveSnapshot, dispatch],
  );

  const handleSetDepth = useCallback(
    async (depth: number) => {
      if (!productIds) return;

      try {
        await saveSnapshot();
        await setConfigBatch({}, { Depth: depth });

        dispatch(setSelectedDimensions({ depth }));
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set depth", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [productIds, saveSnapshot, dispatch],
  );

  const handleSetHandleType = useCallback(
    async (handleType: string) => {
      try {
        await saveSnapshot();
        pendingHandleSyncRef.current = true;
        dispatch(setSelectedProductConfig({ ...selectedProductConfig, Handle: handleType }));

        if (productIds.length) {
          await setConfigBatch({}, { Handle: handleType });
        }
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set handle type", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [dispatch, productIds, saveSnapshot, selectedProductConfig],
  );

  // After a handle selection forces a new height via the rules engine, push it to PlayCanvas.
  // The same effect in RightCabinetStyleSidebar.
  useEffect(() => {
    if (!pendingHandleSyncRef.current) return;

    if (selectedDimensions.height === null || selectedDimensions.height === undefined) return;

    pendingHandleSyncRef.current = false;
    setConfigBatch({}, { Height: selectedDimensions.height });
  }, [selectedDimensions]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [isDrawerOpen]);

  const handleRemoveProducts = useCallback(async () => {
    if (!selectedSceneProduct) return;

    try {
      await saveSnapshot();
      await removeProduct(selectedSceneProduct);
      dispatch(removeProductId(selectedSceneProduct));
    } catch (error) {
      console.error("[PlayCanvasIntegration] Failed to remove product", error);
    } finally {
      setDropdownState((prev) => ({ ...prev, visible: false }));
    }
  }, [dispatch, selectedSceneProduct, saveSnapshot]);

  const normalizeProductType = useCallback((value: string, productId: string) => {
    const lastDash = value.lastIndexOf("-");
    if (lastDash > 0) {
      const suffix = value.slice(lastDash + 1);
      if (suffix.length >= 6) {
        return value.slice(0, lastDash);
      }
    }

    if (value === productId) {
      const idLastDash = productId.lastIndexOf("-");
      if (idLastDash > 0) {
        const idSuffix = productId.slice(idLastDash + 1);
        if (idSuffix.length >= 6) {
          return productId.slice(0, idLastDash);
        }
      }
    }

    return value;
  }, []);
  const resolveProductTypeFromId = useCallback(
    (productId: string, config?: Record<string, unknown>) => {
      const configProductType = typeof config?.productType === "string" ? config.productType : null;
      if (configProductType) return normalizeProductType(configProductType, productId);

      const configEntityName = typeof config?.entityName === "string" ? config.entityName : null;
      if (configEntityName) return normalizeProductType(configEntityName, productId);

      const lastDash = productId.lastIndexOf("-");
      if (lastDash > 0) {
        return productId.slice(0, lastDash);
      }

      return productId;
    },
    [normalizeProductType],
  );

  const handleDuplicateProduct = useCallback(() => {
    if (!selectedSceneProduct) return;
    setDuplicateSourceId(selectedSceneProduct);
    setVisibleButtons(true);

    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [selectedSceneProduct]);

  useEffect(() => {
    if (!duplicateSourceId) return;

    const onPlusClick = async (entityId: string, side: "left" | "right") => {
      try {
        await saveSnapshot();
        const config = await getConfig(duplicateSourceId);
        if (!config) return;
        const mergedConfig = { ...config, ...selectedProductConfig };

        console.log("mergedConfig", mergedConfig);

        const productType = resolveProductTypeFromId(duplicateSourceId, mergedConfig);
        const productId = await setProductByParams(productType, entityId, side);
        if (!productId) return;

        await setConfig(productId, mergedConfig);
        dispatch(addProductId(productId));

        const drawers = mergedConfig.Drawers as string | undefined;
        const drawerRawValue = drawers === "1D" ? "1" : drawers === "2D" ? "2" : drawers === "1DWID" ? "1+inner" : null;
        if (drawerRawValue) dispatch(setPlacedCabinetStyle({ id: productId, value: drawerRawValue }));

        updateDimensionDataForProduct(productId, mergedConfig);
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to duplicate product", error);
      } finally {
        setVisibleButtons(false);
        setDuplicateSourceId(null);
      }
    };

    setHandleButtonClick(onPlusClick);

    return () => {
      setVisibleButtons(false);
    };
  }, [dispatch, duplicateSourceId, resolveProductTypeFromId, selectedProductConfig, saveSnapshot]);

  // Navigate to the Cabinet builder page with the enabled Right sidebar.
  const handleAddAdditionalProduct = useCallback(() => {
    navigate("/custom/cabinet-builder?accordion=cabinet-type");

    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const handleSwapProducts = useCallback(
    async (idA: string, idB: string) => {
      await saveSnapshot();
      swapProducts(idA, idB);
      dispatch(swapProductIds({ idA, idB }));
    },
    [dispatch, saveSnapshot],
  );

  const handleMoveProduct = useCallback(
    async (direction: "left" | "right") => {
      if (!selectedSceneProduct) return;

      const orderedIds = getOrderedProductIds(productIds);
      const currentIndex = orderedIds.indexOf(selectedSceneProduct);
      if (currentIndex === -1) return;

      const neighborIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (neighborIndex < 0 || neighborIndex >= orderedIds.length) return;

      await handleSwapProducts(selectedSceneProduct, orderedIds[neighborIndex]);
      setDropdownState((prev) => ({ ...prev, visible: false }));
    },
    [handleSwapProducts, productIds, selectedSceneProduct],
  );

  const handleOpenCabinetStyle = useCallback(() => {
    navigate("/custom/cabinet-builder?accordion=cabinet-style");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const handleOpenCabinetColor = useCallback(() => {
    navigate("/custom/cabinet-colors?accordion=cabinet-color");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const isCountertopEntity = useCallback((entityName: string | null, config?: Record<string, unknown>) => {
    if (!entityName) return false;
    const candidates = [
      entityName,
      typeof config?.ProductType === "string" ? (config.ProductType as string) : null,
      typeof config?.productType === "string" ? (config.productType as string) : null,
      typeof config?.type === "string" ? (config.type as string) : null,
      typeof config?.entityName === "string" ? (config.entityName as string) : null,
    ].filter(Boolean) as string[];

    return candidates.some((value) => value.startsWith("Top_"));
  }, []);

  const selectToolAttachedRef = useRef(false);
  const selectTool = getSelectTool();

  if (selectTool && !selectToolAttachedRef.current) {
    selectToolAttachedRef.current = true;

    selectTool.on("select", (selectedEntity) => {
      const firstSelected = Array.isArray(selectedEntity) ? selectedEntity[0] : selectedEntity;

      if (firstSelected) {
        console.log(`Выбран объект: ${firstSelected.name}`);

        (async () => {
          const config = await getConfig(firstSelected.name ?? "");

          if (!config) return;

          dispatch(setSelectedSceneProduct(firstSelected.name!));
          // replace any previous selection
          selectTool?.setSelectedByName(firstSelected.name ?? "", { mode: "replace" });

          updateDimensionDataForProduct(firstSelected.name ?? "", config);

          if (isCountertopEntity(firstSelected.name ?? "", config)) {
            setDropdownState((prev) => ({ ...prev, visible: false }));
            showCountertopPopoverForEntity(firstSelected.name ?? "");
          } else {
            setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
            showDropdownForEntity(firstSelected.name ?? "");
          }
        })();
      } else {
        console.log("клик в пустоту");
        // dispatch(setSelectedSceneProduct(""));
        setDropdownState((prev) => ({ ...prev, visible: false }));
        setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
      }
    });
  }

  useEffect(() => {
    if (!countertopPopoverState.visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !countertopPopoverRef.current) return;
      if (!countertopPopoverRef.current.contains(target)) {
        closeCountertopPopover();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [closeCountertopPopover, countertopPopoverState.visible]);

  useEffect(() => {
    const entityName = countertopPopoverState.entityName;
    if (!countertopPopoverState.visible || !entityName) return;

    const handleResize = () => {
      const iframeEl = containerRef.current;
      if (!iframeEl) return;
      const pos = getDropdownPosition(entityName, iframeEl, lastPointerPosRef.current, {
        width: 360,
        height: 320,
      });
      setCountertopPopoverState((prev) => ({ ...prev, x: pos.x, y: pos.y }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [countertopPopoverState.entityName, countertopPopoverState.visible]);

  useEffect(() => {
    if (!selectedSceneProduct) return;

    const loadConfig = async () => {
      const config = await getConfig(selectedSceneProduct);
      if (!config) return;

      const productType =
        (typeof config.ProductType === "string" && config.ProductType) ||
        (typeof config.productType === "string" && config.productType) ||
        (typeof config.type === "string" && config.type) ||
        null;
      const resolvedCabinetTypeId = resolveCabinetTypeId(productType ?? selectedSceneProduct);

      if (resolvedCabinetTypeId !== null) {
        dispatch(setActiveCabinetType(resolvedCabinetTypeId));
      }

      dispatch(setSelectedProductConfig(config));

      const nextDimensions: { width?: number; height?: number; depth?: number } = {};

      if (typeof config.Width === "number") nextDimensions.width = config.Width;
      if (typeof config.Height === "number") nextDimensions.height = config.Height;
      if (typeof config.Depth === "number") nextDimensions.depth = config.Depth;

      if (Object.keys(nextDimensions).length) {
        dispatch(setSelectedDimensions(nextDimensions));
      }
    };

    loadConfig();
  }, [dispatch, resolveCabinetTypeId, selectedSceneProduct]);

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const widthOptions = dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value);
    const depthOptions = dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value);

    const items: DropdownItem[] = [
      {
        id: "resize",
        label: "Resize",
        children: [
          {
            id: "resize-width",
            label: "Width",
            children: widthOptions.map((value) => ({
              id: `resize-width-${value}`,
              label: `${value}`,
              onClick: () => handleSetWidth(Number(value)),
            })),
          },
          {
            id: "resize-depth",
            label: "Depth",
            children: depthOptions.map((value) => ({
              id: `resize-depth-${value}`,
              label: `${value}`,
              onClick: () => handleSetDepth(Number(value)),
            })),
          },
        ],
      },
      {
        id: "reposition",
        label: "Reposition",
        children: [
          { id: "reposition-left", label: "Move left", onClick: () => handleMoveProduct("left") },
          { id: "reposition-right", label: "Move right", onClick: () => handleMoveProduct("right") },
        ],
      },
      {
        id: "color",
        label: "Color",
        children: [
          {
            id: "cabinet-select-color",
            label: "Select Color",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCabinetColor,
          },
        ],
      },
      {
        id: "add",
        label: "Add",
        trailing: "",
        children: [
          // { id: "add-left", label: "Add to left", onClick: () => handleAddLeft(activeDrawerProduct) },
          // { id: "add-right", label: "Add to right", onClick: () => handleAddRight(activeDrawerProduct) },
          {
            id: "add-right",
            label: "Add Cabinet",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: () => handleAddAdditionalProduct(),
          },
        ],
      },
      ...(isDrawerCabinet
        ? [
            {
              id: "details",
              label: "Details",
              trailing: "",
              children: [
                {
                  id: "cabinet-style",
                  label: "Cabinet Style",
                  trailing: <ArrowTopRight color={"#333"} />,
                  onClick: handleOpenCabinetStyle,
                },
                {
                  id: "handle-style",
                  label: "Handle Style",
                  trailing: "",
                  children: handleOptions.map((option) => ({
                    id: option.value,
                    label: option.label,
                    trailing: selectedProductConfig?.Handle === option.value ? "✓" : "",
                    onClick: () => handleSetHandleType(option.value),
                  })),
                },
              ],
            } as DropdownItem,
          ]
        : []),
      { id: "duplicate", label: "Duplicate", trailing: <DuplicateIcon />, onClick: handleDuplicateProduct },
      { id: "open", label: "Open", trailing: <OpenMenuIcon />, onClick: () => {} },
    ];

    if (productIds.length) {
      items.push({ id: "delete", label: "Delete", trailing: <DeleteMenuIcon />, onClick: handleRemoveProducts });
    }

    return items;
  }, [
    handleRemoveProducts,
    handleSetWidth,
    handleSetDepth,
    dimensionOptions.depth,
    dimensionOptions.width,
    productIds.length,
    handleMoveProduct,
    handleOpenCabinetStyle,
    handleOpenCabinetColor,
    handleAddAdditionalProduct,
    handleDuplicateProduct,
    isDrawerCabinet,
    handleOptions,
    handleSetHandleType,
    selectedProductConfig,
  ]);

  const handleCountertopThicknessSelect = useCallback(
    async (thickness: number) => {
      if (!selectedSceneProduct || !thickness) return;
      await saveSnapshot();

      await setConfigBatch({}, { Thickness: thickness });
      dispatch(setActiveCountertopThickness(`${thickness}`));
    },
    [dispatch, saveSnapshot, selectedSceneProduct],
  );

  const handleOpenCountertopColor = useCallback(() => {
    navigate("/custom/countertop?accordion=counter-top-color");
    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const handleOpenCountertopStyle = useCallback(() => {
    navigate("/custom/countertop?accordion=countertop-style");
    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const handleOpenBasinStyle = useCallback(() => {
    navigate("/custom/countertop?accordion=basin-style");
    setDropdownState((prev) => ({ ...prev, visible: false }));
    setCountertopPopoverState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const countertopPopoverItems: DropdownItem[] = useMemo(() => {
    return [
      {
        id: "countertop-color",
        label: "Color",
        children: [
          {
            id: "countertop-select-color",
            label: "Select Color",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCountertopColor,
          },
        ],
      },
      {
        id: "countertop-thickness",
        label: "Thickness",
        children: thicknessOptions.map((value) => {
          const label = `${value}"`;
          return {
            id: label,
            label,
            onClick: () => handleCountertopThicknessSelect(value),
          };
        }),
      },
      {
        id: "countertop-style",
        label: "Countertop Style",
        children: [
          {
            id: "countertop-select-style",
            label: "Select Style",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCountertopStyle,
          },
        ],
      },
      {
        id: "basin-style",
        label: "Basin Style",
        children: [
          {
            id: "basin-select-style",
            label: "Select Style",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenBasinStyle,
          },
        ],
      },
    ];
  }, [
    handleOpenBasinStyle,
    handleOpenCountertopColor,
    handleOpenCountertopStyle,
    handleCountertopThicknessSelect,
    thicknessOptions,
  ]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <iframe
        ref={containerRef}
        title="scene"
        id="demo"
        width="100%"
        height="100%"
        src={PLAYCANVAS_SRC}
        style={{
          width: "100%",
          height: "100%",
          flex: "1 1 auto",
          border: "none",
          display: "block",
        }}
      />

      {dropdownState.visible && !isDrawerOpen && (
        <div
          style={{
            position: "absolute",
            top: dropdownState.y,
            left: dropdownState.x,
            pointerEvents: "auto",
            zIndex: 1000,
          }}
        >
          {!isPrebuilt && <NestedDropdown items={dropdownItems} />}
        </div>
      )}

      {countertopPopoverState.visible && !isDrawerOpen && (
        <div
          ref={countertopPopoverRef}
          style={{
            position: "absolute",
            top: countertopPopoverState.y,
            left: countertopPopoverState.x,
            pointerEvents: "auto",
            zIndex: 1000,
          }}
        >
          {!isPrebuilt && <NestedDropdown style={{ width: "200px" }} items={countertopPopoverItems} />}
        </div>
      )}
    </div>
  );
};
