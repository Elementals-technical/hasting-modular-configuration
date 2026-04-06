import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getDividersOption,
  getDividersStyle,
  getProductsPresets,
  getSelectedProducts,
  getSelectedSceneProduct,
  getSidePanelsOption,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { selectSidePanelAvailability } from "@/entities/product/model/store/derivedSelectors";
import { sidePanelAvailabilityRule } from "@/features/configurator-rule-core/options";
import {
  addPlacedDivider,
  clearPlacedDividers,
  removePlacedDivider,
  setDividersOption,
  setDividersStyle,
  setIsDrawerOpen,
  setTowelBarColor,
  setTowelBarOption,
} from "@/entities/product/model/store/slice";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { applyGroove, autoRemoveBoth, isGrooveType } from "@/features/sidePanel";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";
import {
  getAvailableDividerTypes,
  placeDividerToSlot,
  removeDividerFromSlot,
  setDividerSlotClickHandler,
  setOnAddSlotClick,
  setOnOccupiedSlotClick,
  setVisibleDividerSlotButtons,
  showIconDividerSlots,
  wrapExitTopView,
  wrapShowTopView,
} from "@/utils/functions/playcanvas/dividers";
import { exportCameraState, getZoom, importCameraState, setAutoFraming, setZoom, zoomOut } from "@/utils/functions/playcanvas/camera";

import { dividersMockData, optionsSidePanelsData, optionsSwatchData2, optionsSwatchDataTowel } from "./constants";
import { useGetConfiguratorQuery } from "@/entities";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";
import { onDrawerCloseWidgetRender, onDrawerWidgetRender } from "@/utils/functions/playcanvas/drawerWidgetRenderers";
import { useSceneTotalWidth } from "@/shared/hooks/useSceneTotalWidth";

export const AccessoriesPage = () => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const towelSelection = useAppSelector(getTowelBarOption);
  const dividerSelection = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
  const activeSidePanels = useAppSelector(getSidePanelsOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const productsPresets = useAppSelector(getProductsPresets);
  const sceneTotalWidth = useSceneTotalWidth(selectedProducts, null);
  const sidePanelsBlockedByLength340 = sceneTotalWidth !== null && Math.abs(sceneTotalWidth - 340) < 0.01;
  const sidePanelsLengthReason = "Side panels are not available when total vanity length is exactly 340 cm.";
  const isPlayCanvasReady = usePlayCanvasReady();
  const [activeDrawerType, setActiveDrawerType] = useState<"Top" | "TopFull" | "Bot" | null>(null);
  const drawerCameraStateRef = useRef<Record<string, unknown> | null>(null);
  const isDrawerCameraManagedRef = useRef(false);
  const drawerZoomTargetRef = useRef<number | null>(null);

  const selectedDividerType =
    dividerStyle?.trim() === "Option B"
      ? "B"
      : dividerStyle?.trim() === "Option C"
        ? "C"
        : dividerStyle?.trim() === "Option A"
          ? "A"
          : null;

  const resolveDividerType = useCallback(
    (available: string[]) => {
      if (selectedDividerType && available.includes(selectedDividerType)) return selectedDividerType;

      if (available.length > 0) return available[0] as "A" | "B" | "C";
      return (selectedDividerType || "A") as "A" | "B" | "C";
    },
    [selectedDividerType],
  );

  const cloneCameraState = useCallback((state: Record<string, unknown> | null) => {
    if (!state) return null;
    try {
      return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    } catch {
      return state;
    }
  }, []);

  const applyOpenDrawerCameraMode = useCallback(() => {
    if (!isDrawerCameraManagedRef.current) {
      drawerCameraStateRef.current = cloneCameraState(exportCameraState() as Record<string, unknown> | null);
      setAutoFraming(false);
      isDrawerCameraManagedRef.current = true;
    }

    const currentZoom = getZoom();
    if (typeof currentZoom === "number") {
      const targetZoom = currentZoom * 1.85;
      drawerZoomTargetRef.current = targetZoom;
      setZoom(targetZoom);
    } else {
      zoomOut(0.4);
    }
  }, [cloneCameraState]);

  const enforceDrawerZoom = useCallback(() => {
    if (!isDrawerCameraManagedRef.current) return;
    if (typeof drawerZoomTargetRef.current === "number") {
      setZoom(drawerZoomTargetRef.current);
    }
  }, []);

  const restoreDrawerCameraMode = useCallback(() => {
    if (isDrawerCameraManagedRef.current) {
      if (drawerCameraStateRef.current) {
        importCameraState(drawerCameraStateRef.current);
      }
      setAutoFraming(true);
    }

    drawerCameraStateRef.current = null;
    isDrawerCameraManagedRef.current = false;
    drawerZoomTargetRef.current = null;
  }, []);

  const { data: configuratorData } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const selectorAvailability = useAppSelector(selectSidePanelAvailability);

  const sidePanelAvailability = useMemo(() => {
    if (selectorAvailability.allowed.size > 0) return selectorAvailability;

    // Only fall back to presets when no cabinet has been clicked yet
    if (selectedSceneProduct) return selectorAvailability;

    const firstPreset = productsPresets[0];
    if (!firstPreset) return selectorAvailability;

    const name = firstPreset.name ?? null;
    const cabinetType =
      name === "Side-Shelf" || name === "OSS"
        ? "OSS"
        : name === "Open-Shelf" || name === "OS"
          ? "OS"
          : name === "Sink-Base" || name === "Sink-Cabinet" || name === "Side-Cabinet" || name === "SB" || name === "SC"
            ? "SBSC"
            : null;

    const drawers = firstPreset.Drawers ?? null;
    const handleType =
      drawers === "1D" || drawers === "1DWID" || drawers === "1" || drawers === "1+inner"
        ? "1D"
        : drawers === "2D" || drawers === "2"
          ? "2D"
          : null;

    const height = firstPreset.Height ?? null;

    return sidePanelAvailabilityRule({ height, handleType, cabinetType });
  }, [selectorAvailability, productsPresets, selectedSceneProduct]);

  const sidePanelOptions = useMemo(() => {
    if (sidePanelsBlockedByLength340) {
      return optionsSidePanelsData.filter((option) => option.metadata?.value === "None");
    }

    const allowed = new Set<string>(["None"]);
    sidePanelAvailability.allowed.forEach((value) => allowed.add(value));

    return optionsSidePanelsData.filter((option) => {
      const value = option.metadata?.value;
      if (!value) return true;
      return allowed.has(value);
    });
  }, [sidePanelAvailability.allowed, sidePanelsBlockedByLength340]);

  useEffect(() => {
    if (!sidePanelsBlockedByLength340) return;
    if (!activeSidePanels || activeSidePanels === "None") return;

    autoRemoveBoth(dispatch);
  }, [activeSidePanels, dispatch, sidePanelsBlockedByLength340]);

  const towelBarOptionsFromApi = useMemo(() => {
    const groups = (configuratorData?.availableOptions ?? []).filter((g) => g.proxyName === "Towel Bar Color");
    if (!groups.length) return [];

    const allowedCodes = ["0B MT", "43 MT", "M6 MT", "M7 MT", "03 MT"];
    const lacqueredMtMarkers = ["lacquered mt", "lacquer mt", "lacquered matte", "lacquer matte"];
    const isAllowedTowelColor = (text: string | undefined | null) => {
      if (!text) return false;
      const normalized = text.toLowerCase();
      return allowedCodes.some((code) => normalized.includes(code.toLowerCase()));
    };
    const isLacqueredMt = (text: string | undefined | null) => {
      if (!text) return false;
      const normalized = text.toLowerCase();
      return lacqueredMtMarkers.some((marker) => normalized.includes(marker));
    };

    return groups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = (variant.metadata ?? {}) as Record<string, unknown>;
            const label = (meta.label as string) || (meta.Label as string) || variant.name;
            const value = (meta.value as string) || variant.name;
            const image = (meta.image as string) || variant.image || undefined;
            const hex = (meta.hex as string) || undefined;

            return {
              id: variant.id,
              title: label,
              name: variant.name,
              desc: option.name ?? group.proxyName,
              isShortDesc: false,
              metadata: {
                image,
                value,
                hex,
              },
            };
          })
          .filter((item) => {
            const haystack = `${item.title ?? ""} ${item.name ?? ""} ${item.metadata?.value ?? ""} ${item.desc ?? ""}`;
            return isAllowedTowelColor(haystack) && isLacqueredMt(haystack);
          }),
      ),
    );
  }, [configuratorData]);

  useEffect(() => {
    if (towelSelection !== "None") return;

    setConfigBatch(
      {},
      {
        TowelBar: "None",
        TowelBarSide: "both",
      },
    );
  }, [towelSelection]);

  useEffect(() => {
    onDrawerWidgetRender((drawerInfo, parentEl) => {
      parentEl.innerHTML = "";
      parentEl.style.display = "flex";
      parentEl.style.flexDirection = "column";
      parentEl.style.alignItems = "center";
      parentEl.style.gap = "6px";
      parentEl.style.pointerEvents = "auto";

      if (drawerInfo.hasOccupiedDividers) {
        const indicator = document.createElement("div");
        indicator.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        indicator.style.background = "#262b31";
        indicator.style.color = "#fff";
        indicator.style.borderRadius = "999px";
        indicator.style.width = "42px";
        indicator.style.height = "42px";
        indicator.style.display = "flex";
        indicator.style.alignItems = "center";
        indicator.style.justifyContent = "center";
        indicator.style.boxShadow = "0 1px 2px rgba(0,0,0,0.25)";
        parentEl.appendChild(indicator);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open Drawer";
      button.style.background = "#A05535";
      button.style.color = "#fff";
      button.style.border = "none";
      button.style.borderRadius = "999px";
      button.style.padding = "5px 12px";
      button.style.cursor = "pointer";
      button.style.fontSize = "11px";
      button.style.lineHeight = "1.1";
      button.style.fontFamily = "Poppins, sans-serif";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        // @ts-ignore
        const containerRef = window.containerRef;
        const api = containerRef?.current?.contentWindow?.ConfiguratorAPI;
        const normalizedDrawerType = drawerInfo.drawerType === "TopFull" ? "Top" : drawerInfo.drawerType;
        api?.showTopView?.(drawerInfo.cabinetId, normalizedDrawerType);
      });
      parentEl.appendChild(button);
    });

    onDrawerCloseWidgetRender((_, parentEl) => {
      parentEl.innerHTML = "";
      parentEl.style.pointerEvents = "auto";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Close";
      button.style.background = "#282828";
      button.style.color = "#fff";
      button.style.border = "none";
      button.style.borderRadius = "12px";
      button.style.padding = "4px 10px";
      button.style.cursor = "pointer";
      button.style.fontSize = "11px";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        // @ts-ignore
        const containerRef = window.containerRef;
        const api = containerRef?.current?.contentWindow?.ConfiguratorAPI;
        api?.exitTopView?.();
      });
      parentEl.appendChild(button);
    });

    return () => {
      onDrawerWidgetRender(null);
      onDrawerCloseWidgetRender(null);
    };
  }, []);

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const wrapped = wrapShowTopView({
      onSelect: (_, drawerType) => {
        setActiveDrawerType(drawerType);
        dispatch(setIsDrawerOpen(true));
      },

      onAfterSelect: (cabinetId, drawerType) => {
        applyOpenDrawerCameraMode();

        if (dividerSelection === "Customize") {
          setVisibleDividerSlotButtons(true);
          showIconDividerSlots(cabinetId, drawerType);
          enforceDrawerZoom();
        }
      },
    });

    if (!wrapped) {
      console.log("[Drawer] showTopView not ready or already wrapped");
    }
  }, [dispatch, isPlayCanvasReady, dividerSelection, applyOpenDrawerCameraMode, enforceDrawerZoom]);

  useEffect(() => {
    const exitTopView = wrapExitTopView({
      onExit: () => {
        restoreDrawerCameraMode();

        setActiveDrawerType(null);
        dispatch(setIsDrawerOpen(false));
      },
    });

    if (!exitTopView) {
      console.warn("[Drawer] exitTopView not ready");
    }
  }, [dispatch, restoreDrawerCameraMode]);

  useEffect(() => {
    return () => {
      restoreDrawerCameraMode();
    };
  }, [restoreDrawerCameraMode]);

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    if (dividerSelection !== "Customize") {
      setVisibleDividerSlotButtons(false);
      return;
    }

    setVisibleDividerSlotButtons(true);

    if (!selectedSceneProduct) return;

    if (activeDrawerType) {
      showIconDividerSlots(selectedSceneProduct, activeDrawerType);
      enforceDrawerZoom();
    }

    const onAddHandler = setOnAddSlotClick(async (slotInfo) => {
      const available =
        slotInfo.availableTypes?.length > 0
          ? slotInfo.availableTypes
          : getAvailableDividerTypes({
              cabinetId: slotInfo.cabinetId,
              drawerType: slotInfo.drawerType,
              zone: slotInfo.zone,
              key: slotInfo.key,
            }) || [];

      const selectedType = resolveDividerType(available);
      const drawerType = slotInfo.drawerType ?? activeDrawerType;

      if (!drawerType) {
        console.warn("[Dividers] drawerType not resolved for add slot");
        return;
      }

      await placeDividerToSlot({ ...slotInfo, drawerType }, selectedType);
      const compositeKey = `${slotInfo.cabinetId}::${drawerType}::${slotInfo.zone}::${slotInfo.key}`;
      dispatch(
        addPlacedDivider({
          key: compositeKey,
          cabinetId: slotInfo.cabinetId,
          drawerType,
          zone: slotInfo.zone,
          type: selectedType,
        }),
      );
      showIconDividerSlots(slotInfo.cabinetId, drawerType);
      enforceDrawerZoom();
    });

    const onOccupiedHandler = setOnOccupiedSlotClick(async (slotInfo) => {
      const drawerType = slotInfo.drawerType ?? activeDrawerType;
      await removeDividerFromSlot(slotInfo);
      const compositeKey = `${slotInfo.cabinetId}::${drawerType}::${slotInfo.zone}::${slotInfo.key}`;
      dispatch(removePlacedDivider(compositeKey));
      if (drawerType) {
        showIconDividerSlots(slotInfo.cabinetId, drawerType);
        enforceDrawerZoom();
      }
    });

    if (!onAddHandler && !onOccupiedHandler) {
      setDividerSlotClickHandler(async (slotInfo) => {
        if ("isOccupied" in slotInfo && slotInfo.isOccupied) {
          await removeDividerFromSlot(slotInfo);
          const legacyRemoveKey = `${slotInfo.cabinetId}::${slotInfo.drawerType}::${slotInfo.zone}::${slotInfo.key}`;
          dispatch(removePlacedDivider(legacyRemoveKey));
          showIconDividerSlots(slotInfo.cabinetId, slotInfo.drawerType);
          enforceDrawerZoom();
          return;
        }

        const addSlotInfo = slotInfo as {
          cabinetId: string;
          drawerType: "Top" | "TopFull" | "Bot";
          zone: string;
          key: string;
          availableTypes?: string[];
        };

        const available = addSlotInfo.availableTypes?.length
          ? addSlotInfo.availableTypes
          : getAvailableDividerTypes(addSlotInfo) || [];

        const normalizedAddSlotInfo = {
          ...addSlotInfo,
          availableTypes: addSlotInfo.availableTypes ?? [],
        };

        const selectedType = resolveDividerType(available);
        const drawerType = normalizedAddSlotInfo.drawerType ?? activeDrawerType;
        if (!drawerType) {
          console.warn("[Dividers] drawerType not resolved for legacy add slot");
          return;
        }

        await placeDividerToSlot({ ...normalizedAddSlotInfo, drawerType }, selectedType);
        const legacyAddKey = `${normalizedAddSlotInfo.cabinetId}::${drawerType}::${normalizedAddSlotInfo.zone}::${normalizedAddSlotInfo.key}`;
        dispatch(
          addPlacedDivider({
            key: legacyAddKey,
            cabinetId: normalizedAddSlotInfo.cabinetId,
            drawerType,
            zone: normalizedAddSlotInfo.zone,
            type: selectedType,
          }),
        );
        showIconDividerSlots(normalizedAddSlotInfo.cabinetId, drawerType);
        enforceDrawerZoom();
      });
    }
  }, [
    selectedSceneProduct,
    activeDrawerType,
    dispatch,
    dividerSelection,
    selectedDividerType,
    resolveDividerType,
    isPlayCanvasReady,
    enforceDrawerZoom,
  ]);

  // Side panel invalidation is handled by global listener middleware.

  const handleSidePanelsChange = async (value: string) => {
    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    const isEdge = selectedSceneProduct === leftCabinetId || selectedSceneProduct === rightCabinetId;
    if (!value) return;
    if (!isGrooveType(value)) return;
    if (sidePanelsBlockedByLength340 && value !== "None") return;

    await saveSnapshot();
    const side: "left" | "right" | "both" =
      !selectedSceneProduct || !isEdge
        ? "both"
        : selectedProducts.length === 1 || (leftCabinetId && leftCabinetId === rightCabinetId)
          ? "both"
          : selectedSceneProduct === leftCabinetId
            ? "left"
            : selectedSceneProduct === rightCabinetId
              ? "right"
              : "both";
    await applyGroove(dispatch, value, side);
  };

  const handleDividersChange = (value: string | null) => {
    if (!value) return;

    if (value === "None") {
      const exitTopView = wrapExitTopView({
        onExit: () => {
          restoreDrawerCameraMode();

          setActiveDrawerType(null);
          dispatch(setIsDrawerOpen(false));
        },
      });

      if (exitTopView) {
        exitTopView();
      } else {
        console.warn("[Drawer] exitTopView not ready");
      }
    }

    if (value === "Customize") {
      setVisibleDrawerButtons(true);
    } else {
      setVisibleDrawerButtons(false);
      setVisibleDividerSlotButtons(false);

      dispatch(setIsDrawerOpen(false));
    }

    dispatch(setDividersOption(value));
    if (value !== "Customize") {
      dispatch(setDividersStyle(""));
      dispatch(clearPlacedDividers());
    }
  };

  const handleDividerStyleChange = (value: string) => {
    if (!value) return;
    dispatch(setDividersStyle(value));
  };

  const handleTowelBarChange = async (value: string | null) => {
    if (!value) return;

    await saveSnapshot();
    const isNone = value === "None";
    const side = value.toLowerCase() as "left" | "right" | "both";

    // Force-remove existing towel bars first so side switches (e.g. Left -> Right)
    // do not keep stale meshes enabled in the scene.
    await setConfigBatch(
      {},
      {
        TowelBar: "None",
        TowelBarSide: "both",
      },
    );

    if (!isNone) {
      await setConfigBatch(
        {},
        {
          TowelBar: "TowelBar40_R",
          TowelBarSide: side,
        },
      );
    }

    if (isNone) {
      dispatch(setTowelBarColor(""));
    }

    dispatch(setTowelBarOption(value));
  };

  const handleTowelBarColorChange = async (value?: string) => {
    if (!value) return;
    await saveSnapshot();

    setConfigBatch(
      {},
      {
        TowelBarColor: value,
      },
    );

    dispatch(setTowelBarColor(value));
  };

  const handleAccordionChange = (value: string) => {
    if (!value) return;

    if (value === "dividers") {
      setVisibleDrawerButtons(dividerSelection === "Customize");
      return;
    }

    setVisibleDrawerButtons(false);

    const exitTopView = wrapExitTopView({});
    if (exitTopView) exitTopView();
  };

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "side-panels",
      title: "Side Panels",
      defaultOpen: true,
      content: (
        <>
          {sidePanelsBlockedByLength340 ? (
            <p style={{ margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" }}>{sidePanelsLengthReason}</p>
          ) : sidePanelAvailability.reason ? (
            <p style={{ margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" }}>
              {sidePanelAvailability.reason}
            </p>
          ) : (
            <ProductOptionsGrid
              data={sidePanelOptions}
              handleAdd={handleSidePanelsChange}
              activeValue={activeSidePanels}
            />
          )}
        </>
      ),
    },
    {
      id: "dividers",
      title: "Dividers",
      content: (
        <>
          <ProductSwatchesGrid
            data={optionsSwatchData2}
            onSelectChange={handleDividersChange}
            selectedValue={dividerSelection}
          />
          {dividerSelection === "Customize" && (
            <ProductOptionsGrid
              data={dividersMockData}
              handleAdd={handleDividerStyleChange}
              activeValue={dividerStyle}
            />
          )}
        </>
      ),
    },
    {
      id: "towel-bar",
      title: "Towel Bar",
      content: (
        <>
          <ProductSwatchesGrid
            data={optionsSwatchDataTowel}
            onSelectChange={handleTowelBarChange}
            selectedValue={towelSelection}
          />
          {towelSelection && towelSelection !== "None" && (
            <ProductOptionsGrid
              data={towelBarOptionsFromApi}
              handleAdd={handleTowelBarColorChange}
              activeValue={towelBarColor}
              groupByDesc
            />
          )}
        </>
      ),
    },
  ];

  return (
    <div className="accessoriesPage">
      <ConfiguratorAccordionGroup
        defaultValue={ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id.toString()}
        onValueChange={handleAccordionChange}
      >
        {ACCORDIONS.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id.toString()} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
    </div>
  );
};
