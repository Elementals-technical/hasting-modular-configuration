import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { optionsMockData3, optionsMockData4 } from "@/pages/prebuilt/cabinet/constants";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";

import s from "./CabinetPage.module.scss";
import type { AccordionConfig } from "@/shared/constants/types";
import {
  setCabinetColor,
  setCabinetColorSku,
  setCabinetColorFinish,
  setCabinetColorMaterial,
  setBookMatching,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getCabinetColor,
  getBookMatching,
  getCabinetColorMaterial,
  getDrawerPanelFluting,
  getGrainDirection,
  getHandleGrooveColor,
  getProductsPresets,
  getSelectedProductConfig,
  getSelectedSceneProduct,
} from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import {
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import { useGetConfiguratorQuery } from "@/entities";
import { flutingRule } from "@/features/configurator-rule-core/options";
import { BaseButton } from "@/shared";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { openSwatchSidebar } from "@/features/swatchSidebar/model/store/slice";

export const CabinetPage = () => {
  const URBAN_HANDLES = new Set(["handle_urban_topcut", "handle_urban_botcut"]);
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const presetsProducts = useAppSelector(getProductsPresets);
  const activeCabinetColor = useAppSelector(getCabinetColor);
  const activeGrooveColor = useAppSelector(getHandleGrooveColor);
  const activeDrawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const activeGrainDirection = useAppSelector(getGrainDirection);
  const activeBookMatching = useAppSelector(getBookMatching);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const isUrbanHandleSelected = URBAN_HANDLES.has(String(selectedProductConfig?.Handle ?? ""));
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const cabinetMaterial = useAppSelector(getCabinetColorMaterial);
  const grainDirectionState = useAppSelector(selectGrainDirectionState);
  const bookMatchingState = useAppSelector(selectBookMatchingState);
  const selectorFlutingState = useAppSelector(selectFlutingState);

  const flutingState = useMemo(() => {
    if (selectorFlutingState.available) return selectorFlutingState;

    // Trust the selector when user already clicked a cabinet in the scene
    if (selectedSceneProduct) return selectorFlutingState;

    // Fall back to presets for drawer info (same pattern as AccessoriesPage)
    const firstPreset = presetsProducts[0];
    if (!firstPreset) return selectorFlutingState;

    return flutingRule({
      targetPart: "CABINET",
      material: cabinetMaterial,
    });
  }, [selectorFlutingState, selectedSceneProduct, presetsProducts, cabinetMaterial]);

  useEffect(() => {
    if (!flutingState.available && !activeDrawerPanelFluting) {
      setConfigBatch(
        {},
        {
          DrawerPanelFluting: "None",
        },
      );
    }
  }, [flutingState.available, activeDrawerPanelFluting]);

  useEffect(() => {
    if (!grainDirectionState.available && activeGrainDirection) {
      setConfigBatch(
        {},
        {
          GrainDirection: "",
        },
      );
      dispatch(setGrainDirection(""));
    }
  }, [grainDirectionState.available, activeGrainDirection, dispatch]);

  const { data: configuratorData } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const cabinetColorGroups = useMemo(
    () => (configuratorData?.availableOptions ?? []).filter((g) => g.proxyName === "Cabinet Color"),
    [configuratorData],
  );

  const grooveColorGroups = useMemo(
    () => (configuratorData?.availableOptions ?? []).filter((g) => g.proxyName === "Handle Groove Color"),
    [configuratorData],
  );

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
      const pick = (...values: unknown[]): string | undefined => {
        for (const v of values) {
          const str = toOptionalString(v);
          if (str) return str;
        }
        return undefined;
      };
      return {
        material: pick(meta.Material),
        color: pick(meta.Color),
        look: pick(meta.Look),
        hex: pick(meta.hex),
        image: pick(meta.image, variant.image),
        value: pick(meta.value, variant.name),
        label: pick(meta.label, meta.Label, variant.name),
      };
    },
    [],
  );

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

  const buildFiltersFromGroups = useCallback(
    (groups: typeof cabinetColorGroups) => {
      if (!groups.length) return { materials: [], colors: [], looks: [], hex: [] };
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
            if (meta.material) toStringArrayFromCsv(meta.material).forEach((v) => materialSet.add(v));
            toStringArrayFromCsv(meta.color).forEach((v) => colorSet.add(v));
            toStringArrayFromCsv(meta.look).forEach((v) => lookSet.add(v));
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

  const basePanelOptions = useMemo(
    () => buildOptionsFromGroups(cabinetColorGroups),
    [buildOptionsFromGroups, cabinetColorGroups],
  );

  const grooveOptionsFromApi = useMemo(
    () => buildOptionsFromGroups(grooveColorGroups),
    [buildOptionsFromGroups, grooveColorGroups],
  );

  const materialFilters = useMemo(() => {
    const filters = buildFiltersFromGroups(cabinetColorGroups);
    return { ...filters, materials: groupMaterialsHierarchically(filters.materials) };
  }, [buildFiltersFromGroups, cabinetColorGroups]);

  const grooveMaterialFilters = useMemo(() => {
    const filters = buildFiltersFromGroups(grooveColorGroups);
    return { ...filters, materials: groupMaterialsHierarchically(filters.materials) };
  }, [buildFiltersFromGroups, grooveColorGroups]);

  const tierOptions = useMemo(() => buildTierFilterOptions(basePanelOptions), [basePanelOptions]);
  const groovePriceRangeOptions = useMemo(() => buildTierFilterOptions(grooveOptionsFromApi), [grooveOptionsFromApi]);

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const [selectedGrooveFilter, setSelectedGrooveFilter] = useState<MaterialFilterSelection>({});

  const filteredBasePanelOptions = useMemo(
    () => filterOptionsByTier(filterOptionsByMaterialSelection(basePanelOptions, selectedFilter), selectedFilter.tier),
    [basePanelOptions, selectedFilter],
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

  const findOptionByColorName = useCallback(
    (colorName: string) =>
      basePanelOptions.find((option) => option.metadata?.value === colorName || option.name === colorName),
    [basePanelOptions],
  );

  const findSkuByColorName = useCallback(
    (colorName: string): string => {
      for (const option of basePanelOptions) {
        if (option.metadata?.value === colorName || option.name === colorName) {
          return option.metadata?.sku ?? "";
        }
      }
      return "";
    },
    [basePanelOptions],
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

  const clearAllFilters = () => {
    setSelectedFilter({});
    setSelectedGrooveFilter({});
  };

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={materialFilters.materials}
        value={selectedFilter.material}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={materialFilters.colors}
        value={selectedFilter.color}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={materialFilters.looks}
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

  const presetNames = presetsProducts.map((i) => {
    return i.name;
  });

  const handleChangeColor = async (colorName?: string) => {
    if (!colorName) return;
    await saveSnapshot();

    presetNames.forEach(() => {
      setConfigBatch({}, { CabinetColor: colorName });
    });

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

    setConfigBatch({}, { HandleGrooveColor: colorName });

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
    await setConfigBatch(
      {},
      {
        DrawerPanelFluting: value,
      },
    );
    dispatch(setDrawerPanelFluting(value));
  };

  const handleChangeGrainDirection = async (value: string) => {
    if (!value) return;
    await saveSnapshot();
    await setConfigBatch(
      {},
      {
        GrainDirection: value,
      },
    );
    dispatch(setGrainDirection(value));
  };

  const handleToggleBookMatching = (checked: boolean) => {
    dispatch(setBookMatching(checked ? "enabled" : ""));
  };

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
            groupByDesc
          />
        </>
      ),
    },
    ...(isUrbanHandleSelected
      ? [
          {
            id: "handle-groove",
            title: "Handle Groove Color (Optional)",
            content: (
              <>
                <ViewModePanel onOrderSwatches={() => dispatch(openSwatchSidebar())} />
                {renderGrooveFilters()}
                <ProductOptionsGrid
                  data={grooveColorOptions}
                  handleAdd={handleChangeGrooveColor}
                  activeValue={activeGrooveColor}
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

  return (
    <div className={s.cabinetPage}>
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
