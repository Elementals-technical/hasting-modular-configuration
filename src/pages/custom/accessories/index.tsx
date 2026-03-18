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

  const activeCabinetId = selectedSceneProduct;

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
      setZoom(currentZoom * 1.85);
    } else {
      zoomOut(0.4);
    }
  }, [cloneCameraState]);

  const restoreDrawerCameraMode = useCallback(() => {
    if (isDrawerCameraManagedRef.current) {
      if (drawerCameraStateRef.current) {
        importCameraState(drawerCameraStateRef.current);
      }
      setAutoFraming(true);
    }

    drawerCameraStateRef.current = null;
    isDrawerCameraManagedRef.current = false;
  }, []);

  // Get the drawerType.
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const wrapped = wrapShowTopView({
      onSelect: (cabinetId, drawerType) => {
        console.log("[Drawer] selected", { cabinetId, drawerType });

        setActiveDrawerType(drawerType);
        dispatch(setIsDrawerOpen(true));
      },

      onAfterSelect: (cabinetId, drawerType) => {
        applyOpenDrawerCameraMode();

        if (dividerSelection === "Customize") {
          console.log("[Dividers] auto-init after Open Drawer", { cabinetId, drawerType });

          setVisibleDividerSlotButtons(true);
          showIconDividerSlots(cabinetId, drawerType);
        }
      },
    });

    if (!wrapped) {
      console.log("[Drawer] showTopView not ready or already wrapped");
    }
  }, [dispatch, isPlayCanvasReady, dividerSelection, applyOpenDrawerCameraMode]);

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
              drawerType: slotInfo.drawerType,
              zone: slotInfo.zone,
              key: slotInfo.key,
            }) || [];
      console.log("[Dividers] available types", available);

      const selectedType = resolveDividerType(available);
      const drawerType = slotInfo.drawerType ?? activeDrawerType;
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

      const drawerType = slotInfo.drawerType ?? activeDrawerType;
      console.log("[Dividers] resolved drawerType for occupied", drawerType);
      console.log("[Dividers] removeDividerFromSlot start", {
        cabinetId: slotInfo.cabinetId,
        drawerType,
        zone: slotInfo.zone,
        key: slotInfo.key,
      });
      await removeDividerFromSlot(slotInfo);
      console.log("[Dividers] removeDividerFromSlot done");
      const compositeKey = `${slotInfo.cabinetId}::${drawerType}::${slotInfo.zone}::${slotInfo.key}`;
      dispatch(removePlacedDivider(compositeKey));
      if (drawerType) {
        showIconDividerSlots(slotInfo.cabinetId, drawerType);
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
          const legacyRemoveKey = `${slotInfo.cabinetId}::${slotInfo.drawerType}::${slotInfo.zone}::${slotInfo.key}`;
          dispatch(removePlacedDivider(legacyRemoveKey));
          showIconDividerSlots(slotInfo.cabinetId, slotInfo.drawerType);
          return;
        }

        const addSlotInfo = slotInfo as {
          cabinetId: string;
          drawerType: "Top" | "Bot";
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

        const drawerType = normalizedAddSlotInfo.drawerType ?? activeDrawerType;
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

    await setConfigBatch(
      {},
      {
        TowelBar: isNone ? "None" : "TowelBar40_R",
        TowelBarSide: isNone ? "both" : side,
      },
    );

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
