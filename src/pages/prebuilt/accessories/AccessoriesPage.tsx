import { useCallback, useEffect, useMemo, useState } from "react";

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

import { dividersMockData, optionsSidePanelsData, optionsSwatchData2, optionsSwatchDataTowel } from "./constants";
import { useGetConfiguratorQuery } from "@/entities";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";

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
  const isPlayCanvasReady = usePlayCanvasReady();
  const [activeDrawerType, setActiveDrawerType] = useState<"Top" | "Bot" | null>(null);

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
    if (!isPlayCanvasReady) return;

    const wrapped = wrapShowTopView({
      onSelect: (_, drawerType) => {
        setActiveDrawerType(drawerType);
        dispatch(setIsDrawerOpen(true));
      },

      onAfterSelect: (cabinetId, drawerType) => {
        if (dividerSelection === "Customize") {
          setVisibleDividerSlotButtons(true);
          showIconDividerSlots(cabinetId, drawerType);
        }
      },
    });

    if (!wrapped) {
      console.log("[Drawer] showTopView not ready or already wrapped");
    }
  }, [dispatch, isPlayCanvasReady, dividerSelection]);

  useEffect(() => {
    const exitTopView = wrapExitTopView({
      onExit: () => {
        setActiveDrawerType(null);
        dispatch(setIsDrawerOpen(false));
      },
    });

    if (!exitTopView) {
      console.warn("[Drawer] exitTopView not ready");
    }
  }, [dispatch]);

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
    });

    const onOccupiedHandler = setOnOccupiedSlotClick(async (slotInfo) => {
      const drawerType = slotInfo.drawerType ?? activeDrawerType;
      await removeDividerFromSlot(slotInfo);
      const compositeKey = `${slotInfo.cabinetId}::${drawerType}::${slotInfo.zone}::${slotInfo.key}`;
      dispatch(removePlacedDivider(compositeKey));
      if (drawerType) {
        showIconDividerSlots(slotInfo.cabinetId, drawerType);
      }
    });

    if (!onAddHandler && !onOccupiedHandler) {
      setDividerSlotClickHandler(async (slotInfo) => {
        if ("isOccupied" in slotInfo && slotInfo.isOccupied) {
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
  ]);

  // Side panel invalidation is handled by global listener middleware.

  const handleSidePanelsChange = async (value: string) => {
    if (!value || !selectedSceneProduct) return;

    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    const isEdge = selectedSceneProduct === leftCabinetId || selectedSceneProduct === rightCabinetId;

    if (!isEdge) return;

    await saveSnapshot();
    const side: "left" | "right" | "both" =
      selectedProducts.length === 1 || (leftCabinetId && leftCabinetId === rightCabinetId)
        ? "both"
        : selectedSceneProduct === leftCabinetId
          ? "left"
          : selectedSceneProduct === rightCabinetId
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
