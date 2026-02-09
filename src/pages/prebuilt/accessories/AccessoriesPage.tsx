import { useEffect, useMemo } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getDividersOption,
  getDividersStyle,
  getSidePanelsOption,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
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

import {
  dividersMockData,
  optionsSidePanelsData,
  optionsSwatchData2,
  optionsSwatchDataTowel,
} from "./constants";
import { useGetConfiguratorQuery } from "@/entities";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";

export const AccessoriesPage = () => {
  const dispatch = useAppDispatch();
  const towelSelection = useAppSelector(getTowelBarOption);
  const dividerSelection = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
  const activeSidePanels = useAppSelector(getSidePanelsOption);
  const towelBarColor = useAppSelector(getTowelBarColor);

  const { data: configuratorData } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const towelBarOptionsFromApi = useMemo(() => {
    const groups = (configuratorData?.availableOptions ?? []).filter((g) => g.proxyName === "Towel Bar Color");
    if (!groups.length) return [];

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

  const handleSidePanelsChange = async (value: string) => {
    if (!value) return;

    await setConfigBatch({}, { SidePanel: value });
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

  const handleTowelBarColorChange = (value?: string) => {
    if (!value) return;

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
            data={optionsSidePanelsData}
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
