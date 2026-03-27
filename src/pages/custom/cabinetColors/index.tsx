import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import {
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import { useGetConfiguratorQuery } from "@/entities";

import { optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CustomCabinetColorsPage.module.scss";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { BaseButton } from "@/shared";
import {
  getCabinetColor,
  getBookMatching,
  getDrawerPanelFluting,
  getGrainDirection,
  getHandleGrooveColor,
  getSelectedProductConfig,
  getSelectedProducts,
} from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import {
  setCabinetColor,
  setCabinetColorSku,
  setCabinetColorMaterial,
  setCabinetColorFinish,
  setBookMatching,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { openSwatchSidebar } from "@/features/swatchSidebar/model/store/slice";

export const CustomCabinetColorsPage = () => {
  const URBAN_HANDLES = new Set(["handle_urban_topcut", "handle_urban_botcut"]);
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeCabinetColor = useAppSelector(getCabinetColor);
  const activeGrooveColor = useAppSelector(getHandleGrooveColor);
  const activeDrawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const activeGrainDirection = useAppSelector(getGrainDirection);
  const activeBookMatching = useAppSelector(getBookMatching);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const isUrbanHandleSelected = URBAN_HANDLES.has(String(selectedProductConfig?.Handle ?? ""));
  const isPlayCanvasReady = usePlayCanvasReady();
  const grainDirectionState = useAppSelector(selectGrainDirectionState);
  const bookMatchingState = useAppSelector(selectBookMatchingState);
  const flutingState = useAppSelector(selectFlutingState);

  const { data: cabinetColors, isFetching: isFetchingCabinetColors } = useGetConfiguratorQuery({
    id: 4,
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

  const cabinetColorGroups = useMemo(
    () => (cabinetColors?.availableOptions ?? []).filter((g) => g.proxyName === "Cabinet Color"),
    [cabinetColors],
  );

  const grooveColorGroups = useMemo(
    () => (cabinetColors?.availableOptions ?? []).filter((g) => g.proxyName === "Handle Groove Color"),
    [cabinetColors],
  );

  const buildFiltersFromGroups = useCallback(
    (groups: typeof cabinetColorGroups) => {
      if (!groups.length) {
        return { materials: [], colors: [], looks: [], hex: [] };
      }

      const materialSet = new Set<string>();
      const colorSet = new Set<string>();
      const lookSet = new Set<string>();
      const hexSet = new Set<string>();

      groups.forEach((group) => {
        group.options.forEach((option) => {
          if (option.name) materialSet.add(option.name);

          option.variants?.forEach((variant) => {
            if (!variant.enabled) return;

            const meta = getVariantMeta(variant);

            if (meta.material) {
              toStringArrayFromCsv(meta.material).forEach((value) => materialSet.add(value));
            }

            toStringArrayFromCsv(meta.color).forEach((value) => colorSet.add(value));
            toStringArrayFromCsv(meta.look).forEach((value) => lookSet.add(value));
            if (meta.hex) hexSet.add(meta.hex.trim());
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
    },
    [getVariantMeta],
  );

  const apiMaterialFilters = useMemo(() => {
    const filters = buildFiltersFromGroups(cabinetColorGroups);
    return { ...filters, materials: groupMaterialsHierarchically(filters.materials) };
  }, [buildFiltersFromGroups, cabinetColorGroups]);

  const grooveMaterialFilters = useMemo(() => {
    const filters = buildFiltersFromGroups(grooveColorGroups);
    return { ...filters, materials: groupMaterialsHierarchically(filters.materials) };
  }, [buildFiltersFromGroups, grooveColorGroups]);

  const buildOptionsFromGroups = useCallback(
    (groups: typeof cabinetColorGroups) => {
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
    },
    [getVariantMeta],
  );

  const basePanelOptionsFromApi = useMemo(
    () => buildOptionsFromGroups(cabinetColorGroups),
    [buildOptionsFromGroups, cabinetColorGroups],
  );

  const grooveOptionsFromApi = useMemo(
    () => buildOptionsFromGroups(grooveColorGroups),
    [buildOptionsFromGroups, grooveColorGroups],
  );

  const tierOptions = useMemo(() => buildTierFilterOptions(basePanelOptionsFromApi), [basePanelOptionsFromApi]);
  const groovePriceRangeOptions = useMemo(() => buildTierFilterOptions(grooveOptionsFromApi), [grooveOptionsFromApi]);

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const [selectedGrooveFilter, setSelectedGrooveFilter] = useState<MaterialFilterSelection>({});

  const filteredBasePanelOptions = useMemo(
    () =>
      filterOptionsByTier(
        filterOptionsByMaterialSelection(basePanelOptionsFromApi, selectedFilter),
        selectedFilter.tier,
      ),
    [basePanelOptionsFromApi, selectedFilter],
  );

  const sortedBasePanelOptions = useMemo(
    () => [...filteredBasePanelOptions].sort((a, b) => a.title.localeCompare(b.title)),
    [filteredBasePanelOptions],
  );

  const filteredGrooveOptions = useMemo(
    () =>
      filterOptionsByTier(
        filterOptionsByMaterialSelection(grooveOptionsFromApi, selectedGrooveFilter),
        selectedGrooveFilter.tier,
      ),
    [grooveOptionsFromApi, selectedGrooveFilter],
  );

  const sortedGrooveOptions = useMemo(
    () => [...filteredGrooveOptions].sort((a, b) => a.title.localeCompare(b.title)),
    [filteredGrooveOptions],
  );

  const grooveColorOptions = useMemo(
    () => [
      {
        id: "groove-color-none",
        title: "None",
        isShortDesc: false,
        metadata: { value: "None" },
      },
      ...sortedGrooveOptions,
    ],
    [sortedGrooveOptions],
  );

  const clearAllFilters = () => {
    setSelectedFilter({});
    setSelectedGrooveFilter({});
  };

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={apiMaterialFilters.materials}
        value={selectedFilter.material}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={apiMaterialFilters.colors}
        value={selectedFilter.color}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={apiMaterialFilters.looks}
        value={selectedFilter.look}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, look: value as string }))}
      />

      <FilterItem
        label="Price"
        options={tierOptions}
        value={selectedFilter.tier}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, tier: value as string | undefined }))}
      />

      {Object.values(selectedFilter).some(Boolean) && (
        <BaseButton variant="filterBtn" onClick={clearAllFilters}>
          Clear All
        </BaseButton>
      )}
    </FilterRow>
  );

  const renderGrooveFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={grooveMaterialFilters.materials}
        value={selectedGrooveFilter.material}
        onSelect={(value) => setSelectedGrooveFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={grooveMaterialFilters.colors}
        value={selectedGrooveFilter.color}
        onSelect={(value) => setSelectedGrooveFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={grooveMaterialFilters.looks}
        value={selectedGrooveFilter.look}
        onSelect={(value) => setSelectedGrooveFilter((prev) => ({ ...prev, look: value as string }))}
      />

      <FilterItem
        label="Price"
        options={groovePriceRangeOptions}
        value={selectedGrooveFilter.tier}
        onSelect={(value) => setSelectedGrooveFilter((prev) => ({ ...prev, tier: value as string | undefined }))}
      />

      {Object.values(selectedGrooveFilter).some(Boolean) && (
        <BaseButton variant="filterBtn" onClick={clearAllFilters}>
          Clear All
        </BaseButton>
      )}
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

  const findOptionByColorName = useCallback(
    (colorName: string) =>
      basePanelOptionsFromApi.find((option) => option.metadata?.value === colorName || option.name === colorName),
    [basePanelOptionsFromApi],
  );

  const resolveMaterialToken = useCallback((option?: { metadata?: { materials?: string[]; sku?: string } }) => {
    const sku = option?.metadata?.sku?.trim().toUpperCase();
    if (sku === "ESS") return "Essenze";
    if (sku === "HPL") return "HPL";
    if (sku === "3D") return "3D";
    if (sku === "LACM") return "LACM";
    if (sku === "LACG") return "LACG";
    if (sku === "ST") return "ST";
    if (sku === "BM") return "BM";

    const materials = option?.metadata?.materials ?? [];
    const known = ["Essenze", "HPL", "3D"];
    const preferred = materials.filter((token) => token !== "Cabinet Color");

    return preferred.find((token) => known.includes(token)) ?? preferred[0] ?? materials[0] ?? "";
  }, []);

  const extractFinishToken = useCallback((value: string) => {
    const match = value.match(/\b(TKP|TKQ|TKN|10B|10F|10G|10N|1PE|1A1|1A2|1A3|1A4|1A5)\b/);
    return match?.[1] ?? "";
  }, []);

  const handleChangeColor = async (colorName: string) => {
    if (!colorName) return;
    await saveSnapshot();

    console.log("colorName", colorName);

    setConfigBatch(
      {},
      {
        CabinetColor: colorName,
      },
    );

    dispatch(setCabinetColor(colorName));
    dispatch(setCabinetColorSku(findSkuByColorName(colorName)));

    const option = findOptionByColorName(colorName);
    const materialToken = resolveMaterialToken(option);
    const finishToken = extractFinishToken(`${colorName} ${option?.title ?? ""} ${option?.desc ?? ""}`);

    dispatch(setCabinetColorMaterial(materialToken));
    dispatch(setCabinetColorFinish(finishToken));
  };

  const handleChangeGrooveColor = async (colorName: string) => {
    if (!colorName) return;
    await saveSnapshot();

    setConfigBatch(
      {},
      {
        HandleGrooveColor: colorName,
      },
    );

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
    await saveSnapshot();
    await setConfigBatch(selectedProducts, {
      DrawerPanelFluting: value,
    });
    dispatch(setDrawerPanelFluting(value));
  };

  const handleChangeGrainDirection = async (value: string) => {
    if (!value) return;
    await saveSnapshot();
    await setConfigBatch(selectedProducts, {
      GrainDirection: value,
    });
    dispatch(setGrainDirection(value));
  };

  const handleToggleBookMatching = (checked: boolean) => {
    dispatch(setBookMatching(checked ? "enabled" : ""));
  };

  // Fill all products.
  useEffect(() => {
    if (!isPlayCanvasReady || !activeCabinetColor) return;

    setConfigBatch(
      {},
      {
        CabinetColor: activeCabinetColor,
      },
    );
  }, [activeCabinetColor, isPlayCanvasReady, selectedProducts]);

  useEffect(() => {
    if (!isPlayCanvasReady || !activeGrooveColor) return;

    setConfigBatch(selectedProducts, {
      HandleGrooveColor: activeGrooveColor,
    });
  }, [activeGrooveColor, isPlayCanvasReady, selectedProducts]);

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    if (!flutingState.available && !activeDrawerPanelFluting) {
      setConfigBatch(selectedProducts, {
        DrawerPanelFluting: "None",
      });
    }
  }, [flutingState.available, activeDrawerPanelFluting, isPlayCanvasReady, selectedProducts]);

  useEffect(() => {
    if (!isPlayCanvasReady) return;

    if (!grainDirectionState.available && activeGrainDirection) {
      setConfigBatch(selectedProducts, {
        GrainDirection: "",
      });
      dispatch(setGrainDirection(""));
    }
  }, [grainDirectionState.available, activeGrainDirection, isPlayCanvasReady, selectedProducts, dispatch]);

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
          <ViewModePanel onOrderSwatches={() => dispatch(openSwatchSidebar())} />
          {renderFilters()}
          <ProductOptionsGrid
            data={sortedBasePanelOptions}
            handleAdd={handleChangeColor}
            activeValue={activeCabinetColor}
            isLoading={isFetchingCabinetColors}
            groupByDesc
          />
        </>
      ),
    },
    ...(isUrbanHandleSelected
      ? [
          {
            id: "groove-color",
            title: "Handle Groove Color (Optional)",
            content: (
              <>
                <ViewModePanel onOrderSwatches={() => dispatch(openSwatchSidebar())} />
                {renderGrooveFilters()}
                <ProductOptionsGrid
                  data={grooveColorOptions}
                  handleAdd={handleChangeGrooveColor}
                  activeValue={activeGrooveColor}
                  isLoading={isFetchingCabinetColors}
                  groupByDesc
                />
              </>
            ),
          } as AccordionConfig,
        ]
      : []),
    {
      id: "drawer-panel",
      title: "Drawer Panel Fluting",
      content: flutingState.available ? (
        <ProductOptionsGrid
          data={optionsMockData3}
          handleAdd={handleChangeDrawerPanelFluting}
          activeValue={activeDrawerPanelFluting}
        />
      ) : (
        <div className={s.disabledMessage}>{flutingState.reason ?? "Not available."}</div>
      ),
    },
    {
      id: "grain-direction",
      title: "Grain Direction",
      content: grainDirectionState.available ? (
        <>
          <ProductOptionsGrid
            data={optionsMockData4}
            handleAdd={handleChangeGrainDirection}
            activeValue={activeGrainDirection}
          />
          <label className={`${s.checkboxOption} ${!bookMatchingState.enabled ? s.checkboxOptionDisabled : ""}`}>
            <input
              type="checkbox"
              disabled={!bookMatchingState.enabled}
              checked={activeBookMatching === "enabled"}
              onChange={(event) => handleToggleBookMatching(event.target.checked)}
            />
            <span>Book Matching</span>
          </label>
          <div className={s.checkboxHelper}>Create an exclusive, uninterrupted look and bookmatch your pattern</div>
        </>
      ) : (
        <div className={s.disabledMessage}>{grainDirectionState.reason ?? "Not available."}</div>
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
