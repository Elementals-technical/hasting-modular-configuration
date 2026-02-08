import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { filterOptionsByMaterialSelection, type MaterialFilterSelection } from "@/shared/constants/materialFilters";
import { useGetConfiguratorQuery } from "@/entities";

import { optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CustomCabinetColorsPage.module.scss";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getCabinetColor,
  getDrawerPanelFluting,
  getGrainDirection,
  getHandleGrooveColor,
  getSelectedProductConfig,
  getSelectedProducts,
} from "@/entities/product/model/store/selectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import {
  setCabinetColor,
  setCabinetColorSku,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

export const CustomCabinetColorsPage = () => {
  const dispatch = useAppDispatch();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeCabinetColor = useAppSelector(getCabinetColor);
  const activeGrooveColor = useAppSelector(getHandleGrooveColor);
  const activeDrawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const activeGrainDirection = useAppSelector(getGrainDirection);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const isPlayCanvasReady = usePlayCanvasReady();

  const { data: cabinetColors, isFetching: isFetchingCabinetColors } = useGetConfiguratorQuery({
    id: 3,
    view: "full",
    serialize: true,
  });

  const toOptionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

  const toStringArrayFromCsv = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  };

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

  const apiMaterialFilters = useMemo(() => {
    const groups = cabinetColors?.availableOptions ?? [];

    if (!groups.length) {
      return {
        materials: [],
        colors: [],
        looks: [],
        hex: [],
      };
    }

    const materialSet = new Set<string>();
    const colorSet = new Set<string>();
    const lookSet = new Set<string>();
    const hexSet = new Set<string>();

    groups.forEach((group) => {
      if (group.proxyName) materialSet.add(group.proxyName);

      group.options.forEach((option) => {
        if (option.name) materialSet.add(option.name);

        option.variants?.forEach((variant) => {
          if (!variant.enabled) return;

          const meta = getVariantMeta(variant);
          const metaMaterial = meta.material;
          const metaColor = meta.color;
          const metaLook = meta.look;
          const metaHex = meta.hex;

          if (metaMaterial) {
            toStringArrayFromCsv(metaMaterial).forEach((value) => materialSet.add(value));
          }

          toStringArrayFromCsv(metaColor).forEach((value) => colorSet.add(value));
          toStringArrayFromCsv(metaLook).forEach((value) => lookSet.add(value));
          if (metaHex) hexSet.add(metaHex.trim());
        });
      });
    });

    const toOptions = (set: Set<string>) =>
      Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ label: value, value }));

    return {
      materials: toOptions(materialSet),
      colors: toOptions(colorSet),
      looks: toOptions(lookSet),
      hex: toOptions(hexSet),
    };
  }, [cabinetColors, getVariantMeta]);

  const basePanelOptionsFromApi = useMemo(() => {
    const groups = cabinetColors?.availableOptions ?? [];
    if (!groups.length) return [];

    return groups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = getVariantMeta(variant);

            return {
              id: variant.id,
              title: meta.label ?? variant.name,
              name: variant.name,
              desc: option.name ?? group.proxyName,
              isShortDesc: false,
              metadata: {
                image: meta.image,
                value: meta.value ?? variant.name,
                sku: toOptionalString((variant.metadata as Record<string, unknown>)?.sku),
                materials: [
                  ...new Set([group.proxyName, option.name, ...toStringArrayFromCsv(meta.material)].filter(Boolean)),
                ],
                colors: toStringArrayFromCsv(meta.color),
                looks: toStringArrayFromCsv(meta.look),
                hex: meta.hex?.trim(),
              },
            };
          }),
      ),
    );
  }, [cabinetColors, getVariantMeta]);

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});

  const filteredBasePanelOptions = useMemo(
    () => filterOptionsByMaterialSelection(basePanelOptionsFromApi, selectedFilter),
    [basePanelOptionsFromApi, selectedFilter],
  );

  const sortedBasePanelOptions = useMemo(
    () => [...filteredBasePanelOptions].sort((a, b) => a.title.localeCompare(b.title)),
    [filteredBasePanelOptions],
  );

  const grooveColorOptions = useMemo(
    () => [
      {
        id: "groove-color-none",
        title: "None",
        isShortDesc: false,
        metadata: { value: "Blu Pavone A6 MT" },
      },
      ...sortedBasePanelOptions,
    ],
    [sortedBasePanelOptions],
  );

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={apiMaterialFilters.materials}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={apiMaterialFilters.colors}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={apiMaterialFilters.looks}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, look: value as string }))}
      />

      <FilterItem
        label="Price"
        options={apiMaterialFilters.hex}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, hex: value as string }))}
      />
    </FilterRow>
  );

  const findSkuByColorName = useCallback(
    (colorName: string): string => {
      for (const option of basePanelOptionsFromApi) {
        if (option.metadata?.value === colorName || option.name === colorName) {
          return option.metadata?.sku ?? "";
        }
      }
      return "";
    },
    [basePanelOptionsFromApi],
  );

  const handleChangeColor = (colorName: string) => {
    if (!colorName) return;

    console.log("colorName", colorName);

    setConfigBatch({}, {
      CabinetColor: colorName,
    });

    dispatch(setCabinetColor(colorName));
    dispatch(setCabinetColorSku(findSkuByColorName(colorName)));
  };

  const handleChangeGrooveColor = (colorName: string) => {
    if (!colorName) return;

    console.log("HandleGrooveColor", colorName);

    setConfigBatch(selectedProducts, {
      HandleGrooveColor: colorName,
    });

    dispatch(
      setSelectedProductConfig({
        ...selectedProductConfig,
        HandleGrooveColor: colorName,
      }),
    );
    dispatch(setHandleGrooveColor(colorName));
    dispatch(setHandleGrooveColorSku(findSkuByColorName(colorName)));
  };

  const handleChangeDrawerPanelFluting = async (value: string) => {
    if (!value) return;
    await setConfigBatch(selectedProducts, {
      DrawerPanelFluting: value,
    });
    dispatch(setDrawerPanelFluting(value));
  };

  const handleChangeGrainDirection = async (value: string) => {
    if (!value) return;
    await setConfigBatch(selectedProducts, {
      GrainDirection: value,
    });
    dispatch(setGrainDirection(value));
  };

  // Fill all products.
  useEffect(() => {
    if (!isPlayCanvasReady || !activeCabinetColor) return;

    setConfigBatch({}, {
      CabinetColor: activeCabinetColor,
    });
  }, [activeCabinetColor, isPlayCanvasReady, selectedProducts]);

  useEffect(() => {
    if (!isPlayCanvasReady || !activeGrooveColor) return;

    setConfigBatch(selectedProducts, {
      HandleGrooveColor: activeGrooveColor,
    });
  }, [activeGrooveColor, isPlayCanvasReady, selectedProducts]);

  // useEffect(() => {
  //   if (!isPlayCanvasReady || !activeDrawerPanelFluting) return;

  //   setConfigBatch(selectedProducts, {
  //     DrawerPanelFluting: activeDrawerPanelFluting,
  //   });
  // }, [activeDrawerPanelFluting, isPlayCanvasReady, selectedProducts]);

  // useEffect(() => {
  //   if (!isPlayCanvasReady || !activeGrainDirection) return;

  //   setConfigBatch(selectedProducts, {
  //     GrainDirection: activeGrainDirection,
  //   });
  // }, [activeGrainDirection, isPlayCanvasReady, selectedProducts]);

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "cabinet-color",
      title: "Cabinet Color",
      defaultOpen: true,
      content: (
        <>
          <ViewModePanel />
          {renderFilters()}
          <ProductOptionsGrid
            data={sortedBasePanelOptions}
            handleAdd={handleChangeColor}
            activeValue={activeCabinetColor}
            isLoading={isFetchingCabinetColors}
          />
        </>
      ),
    },
    {
      id: "groove-color",
      title: "Handle Groove Color (Optional)",
      content: (
        <>
          <ViewModePanel />
          {renderFilters()}
          <ProductOptionsGrid
            data={grooveColorOptions}
            handleAdd={handleChangeGrooveColor}
            activeValue={activeGrooveColor}
            isLoading={isFetchingCabinetColors}
          />
        </>
      ),
    },
    {
      id: "drawer-panel",
      title: "Drawer Panel Fluting",
      content: (
        <ProductOptionsGrid
          data={optionsMockData3}
          handleAdd={handleChangeDrawerPanelFluting}
          activeValue={activeDrawerPanelFluting}
        />
      ),
    },
    {
      id: "grain-direction",
      title: "Grain Direction",
      content: (
        <ProductOptionsGrid
          data={optionsMockData4}
          handleAdd={handleChangeGrainDirection}
          activeValue={activeGrainDirection}
        />
      ),
    },
  ];

  const defaultValue = ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id;

  const [searchParams] = useSearchParams();
  const [accordionValue, setAccordionValue] = useState(defaultValue);

  useEffect(() => {
    const target = searchParams.get("accordion");
    if (target) setAccordionValue(target);
  }, [searchParams]);

  return (
    <div className={s.cabinetPage}>
      <ConfiguratorAccordionGroup defaultValue={defaultValue} value={accordionValue} onValueChange={setAccordionValue}>
        {ACCORDIONS.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id.toString()} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
    </div>
  );
};
