import { useEffect, useMemo } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getDividersOption,
  getDividersStyle,
  getProductsPresets,
  getSelectedSceneProduct,
  getSidePanelsOption,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import { selectSidePanelAvailability } from "@/entities/product/model/store/derivedSelectors";
import { sidePanelAvailabilityRule } from "@/features/configurator-rule-core/options";
import {
  setDividersOption,
  setDividersStyle,
  setSidePanelsOption,
  setTowelBarColor,
  setTowelBarOption,
} from "@/entities/product/model/store/slice";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { getEdgeCabinets } from "@/utils/functions/playcanvas/getEdgeCabinets";

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
  const productsPresets = useAppSelector(getProductsPresets);

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
      name === "Open-Shelf" || name === "Side-Shelf" || name === "OS"
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

    const allowedCodes = ["20B", "243", "2M6", "2M7", "203"];
    const allowedLabels = ["Bianco", "Carbone", "Creta", "Copper", "Nero"];
    const lacqueredMtMarkers = ["lacquered mt", "lacquer mt", "lacquered matte", "lacquer matte"];
    const isAllowedTowelColor = (text: string | undefined | null) => {
      if (!text) return false;
      const normalized = text.toLowerCase();
      return (
        allowedCodes.some((code) => normalized.includes(code.toLowerCase())) ||
        allowedLabels.some((label) => normalized.includes(label.toLowerCase()))
      );
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

  // Side panel invalidation is handled by global listener middleware.

  const handleSidePanelsChange = async (value: string) => {
    if (!value || !selectedSceneProduct) return;

    const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
    const isEdge = selectedSceneProduct === leftCabinetId || selectedSceneProduct === rightCabinetId;

    if (!isEdge) return;

    await saveSnapshot();
    await setConfigBatch({ cabinetId: selectedSceneProduct }, { SidePanel: value });

    dispatch(setSidePanelsOption(value));
  };

  const handleDividersChange = (value: string | null) => {
    if (!value) return;

    if (value === "Customize") {
      setVisibleDrawerButtons(true);
    } else {
      setVisibleDrawerButtons(false);
    }

    dispatch(setDividersOption(value));
    if (value !== "Customize") {
      dispatch(setDividersStyle(""));
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

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "side-panels",
      title: "Side Panels",
      defaultOpen: true,
      content: (
        <>
          <ProductOptionsGrid
            data={sidePanelOptions}
            handleAdd={handleSidePanelsChange}
            activeValue={activeSidePanels}
          />
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
      <ConfiguratorAccordionGroup defaultValue={ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id.toString()}>
        {ACCORDIONS.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id.toString()} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
    </div>
  );
};
