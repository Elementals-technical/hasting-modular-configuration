import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getDividersOption,
  getDividersStyle,
  getSelectedProducts,
  getSelectedSceneProduct,
  getSidePanelsOption,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { selectSidePanelAvailability } from "@/entities/product/model/store/derivedSelectors";
import {
  addPlacedDivider,
  clearPlacedDividers,
  removePlacedDivider,
  setDividersOption,
  setDividersStyle,
  setIsDrawerOpen,
  setSidePanelsOption,
  setTowelBarColor,
  setTowelBarOption,
} from "@/entities/product/model/store/slice";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setSidePanel } from "@/utils/functions/playcanvas/sidePanels";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
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
import {
  exportCameraState,
  getZoom,
  importCameraState,
  setAutoFraming,
  setZoom,
  zoomOut,
} from "@/utils/functions/playcanvas/camera";

import { dividersMockData, optionsSidePanelsData, optionsSwatchData2, optionsSwatchDataTowel } from "./constants";
import { useGetConfiguratorQuery } from "@/entities";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";
import { onDrawerCloseWidgetRender, onDrawerWidgetRender } from "@/utils/functions/playcanvas/drawerWidgetRenderers";

export const CustomAccessoriesPage = () => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const dividerSelection = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
  const towelSelection = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const activeSidePanels = useAppSelector(getSidePanelsOption);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);

  const isPlayCanvasReady = usePlayCanvasReady();
  const [activeDrawerType, setActiveDrawerType] = useState<"Top" | "Bot" | null>(null);
  const drawerCameraStateRef = useRef<Record<string, unknown> | null>(null);
  const isDrawerCameraManagedRef = useRef(false);
  const drawerZoomTargetRef = useRef<number | null>(null);

  const activeCabinetId = selectedSceneProduct;
  const normalizeDividerDrawerType = (drawerType: "Top" | "TopFull" | "Bot" | null | undefined): "Top" | "Bot" | null =>
    drawerType === "TopFull" ? "Top" : drawerType ?? null;

  const { data: configuratorData } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const sidePanelAvailability = useAppSelector(selectSidePanelAvailability);

  const isEdgeCabinet = useMemo(() => {
    if (!activeCabinetId || !isPlayCanvasReady) return false;
    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    return activeCabinetId === leftCabinetId || activeCabinetId === rightCabinetId;
  }, [activeCabinetId, isPlayCanvasReady]);

  const sidePanelOptions = useMemo(() => {
    const allowed = new Set<string>(["None"]);
    sidePanelAvailability.allowed.forEach((value) => allowed.add(value));

    return optionsSidePanelsData.filter((option) => {
      const value = option.metadata?.value;
      if (!value) return true;
      return allowed.has(value);
    });
  }, [sidePanelAvailability.allowed]);

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
        api?.showTopView?.(drawerInfo.cabinetId, "Top");
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

  // Get the drawerType.
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const wrapped = wrapShowTopView({
      onSelect: (cabinetId, drawerType) => {
        console.log("[Drawer] selected", { cabinetId, drawerType });

        setActiveDrawerType(normalizeDividerDrawerType(drawerType));
        dispatch(setIsDrawerOpen(true));
      },

      onAfterSelect: (cabinetId, drawerType) => {
        applyOpenDrawerCameraMode();

        if (dividerSelection === "Customize") {
          console.log("[Dividers] auto-init after Open Drawer", { cabinetId, drawerType });

          setVisibleDividerSlotButtons(true);
          const normalizedDrawerType = normalizeDividerDrawerType(drawerType);
          if (!normalizedDrawerType) return;
          showIconDividerSlots(cabinetId, normalizedDrawerType);
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

        console.log("[Drawer] exitTopView triggered by Close");

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

  // Side panel invalidation is handled by global listener middleware.

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    if (dividerSelection !== "Customize") {
      setVisibleDividerSlotButtons(false);
      return;
    }

    setVisibleDividerSlotButtons(true);

    if (!activeCabinetId) return;

    console.log("[Dividers] init", {
      activeCabinetId,
      activeDrawerType,
      dividerSelection,
      selectedDividerType,
      isPlayCanvasReady,
    });

    if (activeDrawerType) {
      console.log("[Dividers] showIconDividerSlots start", {
        activeCabinetId,
        activeDrawerType,
      });
      showIconDividerSlots(activeCabinetId, activeDrawerType);
      enforceDrawerZoom();
      console.log("[Dividers] showIconDividerSlots called");
    } else {
      console.log("[Dividers] skip showIconDividerSlots: activeDrawerType is null");
    }

    const onAddHandler = setOnAddSlotClick(async (slotInfo) => {
      console.log("[Dividers] onAddHandler fired", slotInfo);
      console.log("[Dividers] slotInfo.drawerType", slotInfo?.drawerType);
      console.log("[Dividers] add slot click", {
        cabinetId: slotInfo?.cabinetId,
        drawerType: slotInfo?.drawerType,
        zone: slotInfo?.zone,
        key: slotInfo?.key,
        availableTypes: slotInfo?.availableTypes,
        selectedDividerType,
      });

      const available =
        slotInfo.availableTypes?.length > 0
          ? slotInfo.availableTypes
          : getAvailableDividerTypes({
              cabinetId: slotInfo.cabinetId,
              drawerType: normalizeDividerDrawerType(slotInfo.drawerType) ?? "Top",
              zone: slotInfo.zone,
              key: slotInfo.key,
            }) || [];
      console.log("[Dividers] available types", available);

      const selectedType = resolveDividerType(available);
      const drawerType = normalizeDividerDrawerType(slotInfo.drawerType) ?? activeDrawerType;
      console.log("[Dividers] resolved", { selectedType, drawerType });

      if (!drawerType) {
        console.warn("[Dividers] drawerType not resolved for add slot");
        return;
      }

      console.log("[Dividers] placeDividerToSlot start", {
        cabinetId: slotInfo.cabinetId,
        drawerType,
        zone: slotInfo.zone,
        key: slotInfo.key,
        selectedType,
      });
      await placeDividerToSlot({ ...slotInfo, drawerType }, selectedType);
      console.log("[Dividers] placeDividerToSlot done");
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
      console.log("[Dividers] showIconDividerSlots after add");
    });

    const onOccupiedHandler = setOnOccupiedSlotClick(async (slotInfo) => {
      console.log("[Dividers] onOccupiedHandler fired", slotInfo);
      console.log("[Dividers] slotInfo.drawerType", slotInfo?.drawerType);
      console.log("[Dividers] occupied slot click", {
        cabinetId: slotInfo?.cabinetId,
        drawerType: slotInfo?.drawerType,
        zone: slotInfo?.zone,
        key: slotInfo?.key,
        stateId: slotInfo?.stateId,
        dividerType: slotInfo?.dividerType,
      });

      const drawerType = normalizeDividerDrawerType(slotInfo.drawerType) ?? activeDrawerType;
      console.log("[Dividers] resolved drawerType for occupied", drawerType);
      console.log("[Dividers] removeDividerFromSlot start", {
        cabinetId: slotInfo.cabinetId,
        drawerType,
        zone: slotInfo.zone,
        key: slotInfo.key,
      });
      await removeDividerFromSlot(slotInfo);
      console.log("[Dividers] removeDividerFromSlot done");
      const normalizedDrawerType = drawerType ?? "Top";
      const compositeKey = `${slotInfo.cabinetId}::${normalizedDrawerType}::${slotInfo.zone}::${slotInfo.key}`;
      dispatch(removePlacedDivider(compositeKey));
      if (normalizedDrawerType) {
        showIconDividerSlots(slotInfo.cabinetId, normalizedDrawerType);
        enforceDrawerZoom();
        console.log("[Dividers] showIconDividerSlots after remove");
      }
    });

    if (!onAddHandler && !onOccupiedHandler) {
      console.log("[Dividers] fallback setDividerSlotClickHandler");
      setDividerSlotClickHandler(async (slotInfo) => {
        console.log("[Dividers] legacy handler fired", slotInfo);
        if ("isOccupied" in slotInfo && slotInfo.isOccupied) {
          console.log("[Dividers] legacy occupied - remove");
          await removeDividerFromSlot(slotInfo);
          const normalizedLegacyDrawerType = normalizeDividerDrawerType(slotInfo.drawerType) ?? "Top";
          const legacyRemoveKey = `${slotInfo.cabinetId}::${normalizedLegacyDrawerType}::${slotInfo.zone}::${slotInfo.key}`;
          dispatch(removePlacedDivider(legacyRemoveKey));
          showIconDividerSlots(slotInfo.cabinetId, normalizedLegacyDrawerType);
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

        console.log("[Dividers] legacy available types", available);
        const normalizedAddSlotInfo = {
          ...addSlotInfo,
          availableTypes: addSlotInfo.availableTypes ?? [],
        };

        const selectedType = resolveDividerType(available);
        console.log("[Dividers] legacy add click", { selectedType, slotInfo: normalizedAddSlotInfo });

        const drawerType = normalizeDividerDrawerType(normalizedAddSlotInfo.drawerType) ?? activeDrawerType;
        console.log("[Dividers] legacy resolved", { selectedType, drawerType });
        if (!drawerType) {
          console.warn("[Dividers] drawerType not resolved for legacy add slot");
          return;
        }

        console.log("[Dividers] legacy placeDividerToSlot start", {
          cabinetId: normalizedAddSlotInfo.cabinetId,
          drawerType,
          zone: normalizedAddSlotInfo.zone,
          key: normalizedAddSlotInfo.key,
          selectedType,
        });
        await placeDividerToSlot({ ...normalizedAddSlotInfo, drawerType }, selectedType);
        console.log("[Dividers] legacy placeDividerToSlot done");
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
        console.log("[Dividers] legacy showIconDividerSlots after add");
      });
    }
  }, [
    activeCabinetId,
    activeDrawerType,
    dispatch,
    dividerSelection,
    selectedDividerType,
    resolveDividerType,
    isPlayCanvasReady,
    enforceDrawerZoom,
  ]);

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

  const handleSidePanelsChange = async (value: string) => {
    if (!value || !activeCabinetId || !isEdgeCabinet) return;

    await saveSnapshot();

    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    const side: "left" | "right" | "both" =
      selectedProducts.length === 1 || (leftCabinetId && leftCabinetId === rightCabinetId)
        ? "both"
        : activeCabinetId === leftCabinetId
          ? "left"
          : activeCabinetId === rightCabinetId
            ? "right"
            : "both";

    await setSidePanel(value, side);

    dispatch(setSidePanelsOption(value));
  };

  const handleDividersChange = (value: string | null) => {
    if (!value) return;

    if (value === "None") {
      const exitTopView = wrapExitTopView({
        onExit: () => {
          restoreDrawerCameraMode();

          console.log("[Drawer] exitTopView triggered by Dividers None");
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
          {sidePanelAvailability.reason ? (
            <p style={{ margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" }}>
              {sidePanelAvailability.reason}
            </p>
          ) : activeCabinetId && !isEdgeCabinet ? (
            <p style={{ margin: 0, padding: "12px 0", fontSize: 14, color: "#4a5568" }}>
              Side panels can only be installed on edge cabinets.
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
      id: "tovel-bar",
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
