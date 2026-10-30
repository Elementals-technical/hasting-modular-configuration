import { useMemo, useState } from "react";

import {
  ProductOptionsGrid,
  type ProductOptionData,
  type ProductOptionMetadata,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { BaseButton } from "@/shared";
import {
  filterOptionsByMaterialTree,
  groupMaterialsHierarchically,
  nestGbMaterials,
  sortOptionsByMaterialFilterOrder,
  toFilterOptions,
  type FilterOption,
  type MaterialFilterSelection,
  type MaterialGroup,
} from "@/shared/constants/materialFilters";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { FieldStack } from "@/shared/ui/FieldStack/FieldStack";

import {
  selectMaterialHierarchy,
  selectPriceTierOverride,
  type FieldOptionState,
  type FieldRuntimeState,
} from "@/entities/collection";
import { getActiveProductProfile } from "@/entities/configuration";
import { useAppSelector } from "@/shared/hooks/store/redux";

import s from "./ColorField.module.scss";

type ColorFieldProps = {
  field: FieldRuntimeState;
  title: string;
  /** The value of the swatch picked and its SKU: two swatches can share a value (as Tekorlux and as Glass MT). */
  onChange: (value: string, sku?: string) => void | Promise<void>;
  onOrderSwatches: () => void;
  sortByTitle?: boolean;
};

type ColorFilters = { materials: FilterOption[]; colors: FilterOption[]; looks: FilterOption[] };

const buildColorFilters = (
  options: ProductOptionData[],
  section: string,
  hierarchy: readonly MaterialGroup[],
): ColorFilters => ({
  materials: groupMaterialsHierarchically(
    toFilterOptions(
      new Set(options.flatMap((option) => option.metadata?.materials ?? []).filter((token) => token !== section)),
    ),
    hierarchy,
  ),
  colors: toFilterOptions(new Set(options.flatMap((option) => option.metadata?.colors ?? []))),
  looks: toFilterOptions(new Set(options.flatMap((option) => option.metadata?.looks ?? []))),
});

const sortOptions = (list: ProductOptionData[], byTitle: boolean | undefined, materials: FilterOption[]) =>
  byTitle
    ? [...list].sort((a, b) => a.title.localeCompare(b.title))
    : sortOptionsByMaterialFilterOrder(list, materials);

const toProductOptionData = (option: FieldOptionState, index: number): ProductOptionData => ({
  id: index,
  title: option.label ?? option.value,
  desc: option.desc,
  // The colour grid shows every option; one its rules refuse stays in it, unavailable, with their reason.
  isAvailable: option.enabled,
  disabledReason: option.reason,
  disabledReasonCode: option.reasonCode,
  isShortDesc: false,
  metadata: { ...option.traits, value: option.value, image: option.image },
});

export const ColorField = ({ field, title, onChange, onOrderSwatches, sortByTitle }: ColorFieldProps) => {
  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  // An option of no material group is no colour of the catalog but one the profile adds ("None"):
  // it comes first, outside the groups, the filters and the full mode.
  const leadingOptions = useMemo(
    () => field.options.filter((option) => !option.desc).map(toProductOptionData),
    [field.options],
  );
  const profile = useAppSelector(getActiveProductProfile);
  // A colour of a header material (Solid Surface) is filtered and grouped by its GB material (Technolite).
  const { options, hierarchy: materialHierarchy } = useMemo(
    () =>
      nestGbMaterials(
        field.options.filter((option) => option.desc).map(toProductOptionData),
        selectMaterialHierarchy(profile),
      ),
    [field.options, profile],
  );
  const filters = useMemo(
    () => buildColorFilters(options, title, materialHierarchy),
    [options, title, materialHierarchy],
  );
  const tierOverride = useMemo(() => selectPriceTierOverride(profile, field.attributeId), [profile, field.attributeId]);
  const tierOptions = useMemo(() => buildTierFilterOptions(options, tierOverride), [options, tierOverride]);

  const allOptions = useMemo(
    () => sortOptions(options, sortByTitle, filters.materials),
    [filters.materials, options, sortByTitle],
  );
  const visibleOptions = useMemo(
    () =>
      sortOptions(
        filterOptionsByTier(
          filterOptionsByMaterialTree(options, filters.materials, selectedFilter),
          selectedFilter.tier,
          tierOverride,
        ),
        sortByTitle,
        filters.materials,
      ),
    [filters.materials, options, selectedFilter, sortByTitle, tierOverride],
  );

  const activeValue = typeof field.value === "string" ? field.value : null;
  // The grids and the full mode hand over the swatch picked, with the SKU of its configurator variant.
  const pickSwatch = (value: string, _config?: unknown, metadata?: ProductOptionMetadata) =>
    onChange(value, metadata?.sku);
  const select = (key: keyof MaterialFilterSelection) => (value?: string | number) =>
    setSelectedFilter((prev) => ({ ...prev, [key]: value === undefined ? undefined : String(value) }));

  return (
    <div>
      <ViewModePanel
        onOrderSwatches={onOrderSwatches}
        fullModeTitle={title}
        fullModeOptions={allOptions}
        fullModeActiveValue={activeValue}
        onFullModeSelect={pickSwatch}
        fullModeGroupByDesc
        fullModeMaterialFilterOptions={filters.materials}
        fullModeColorFilterOptions={filters.colors}
        fullModeLookFilterOptions={filters.looks}
        fullModeTierFilterOptions={tierOptions}
        fullModeTierOverride={tierOverride}
      />
      <FilterRow className={s.filters}>
        <FilterItem
          label="Material"
          options={filters.materials}
          value={selectedFilter.material}
          onSelect={select("material")}
        />
        <FilterItem label="Color" options={filters.colors} value={selectedFilter.color} onSelect={select("color")} />
        <FilterItem label="Look" options={filters.looks} value={selectedFilter.look} onSelect={select("look")} />
        <FilterItem label="Price" options={tierOptions} value={selectedFilter.tier} onSelect={select("tier")} />
        {Object.values(selectedFilter).some(Boolean) && (
          <BaseButton variant="filterBtn" onClick={() => setSelectedFilter({})}>
            Clear All
          </BaseButton>
        )}
      </FilterRow>
      <FieldStack>
        {leadingOptions.length > 0 && (
          <ProductOptionsGrid data={leadingOptions} handleAdd={pickSwatch} activeValue={activeValue} />
        )}
        <ProductOptionsGrid data={visibleOptions} handleAdd={pickSwatch} activeValue={activeValue} groupByDesc />
      </FieldStack>
    </div>
  );
};
