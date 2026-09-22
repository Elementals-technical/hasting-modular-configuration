import { useMemo, useState } from "react";

import {
  ProductOptionsGrid,
  type ProductOptionData,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { BaseButton } from "@/shared";
import {
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  sortOptionsByMaterialFilterOrder,
  type FilterOption,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";

import type { FieldOptionState, FieldRuntimeState } from "@/entities/collection";

import s from "./ColorField.module.scss";

type ColorFieldProps = {
  field: FieldRuntimeState;
  title: string;
  onChange: (value: string) => void | Promise<void>;
  onOrderSwatches: () => void;
  sortByTitle?: boolean;
};

type ColorFilters = { materials: FilterOption[]; colors: FilterOption[]; looks: FilterOption[] };

const toFilterOptions = (values: string[]): FilterOption[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b)).map((value) => ({ label: value, value }));

const buildColorFilters = (options: ProductOptionData[], section: string): ColorFilters => ({
  materials: groupMaterialsHierarchically(
    toFilterOptions(options.flatMap((option) => option.metadata?.materials ?? []).filter((token) => token !== section)),
  ),
  colors: toFilterOptions(options.flatMap((option) => option.metadata?.colors ?? [])),
  looks: toFilterOptions(options.flatMap((option) => option.metadata?.looks ?? [])),
});

const sortOptions = (list: ProductOptionData[], byTitle: boolean | undefined, materials: FilterOption[]) =>
  byTitle
    ? [...list].sort((a, b) => a.title.localeCompare(b.title))
    : sortOptionsByMaterialFilterOrder(list, materials);

const toProductOptionData = (option: FieldOptionState, index: number): ProductOptionData => ({
  id: index,
  title: option.label ?? option.value,
  desc: option.desc,
  isShortDesc: false,
  metadata: { ...option.traits, value: option.value, image: option.image },
});

export const ColorField = ({ field, title, onChange, onOrderSwatches, sortByTitle }: ColorFieldProps) => {
  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const options = useMemo(() => field.options.map(toProductOptionData), [field.options]);
  const filters = useMemo(() => buildColorFilters(options, title), [options, title]);
  const tierOptions = useMemo(() => buildTierFilterOptions(options), [options]);

  const allOptions = useMemo(
    () => sortOptions(options, sortByTitle, filters.materials),
    [filters.materials, options, sortByTitle],
  );
  const visibleOptions = useMemo(
    () =>
      sortOptions(
        filterOptionsByTier(filterOptionsByMaterialSelection(options, selectedFilter), selectedFilter.tier),
        sortByTitle,
        filters.materials,
      ),
    [filters.materials, options, selectedFilter, sortByTitle],
  );

  const activeValue = typeof field.value === "string" ? field.value : null;
  const select = (key: keyof MaterialFilterSelection) => (value?: string | number) =>
    setSelectedFilter((prev) => ({ ...prev, [key]: value === undefined ? undefined : String(value) }));

  return (
    <>
      <ViewModePanel
        onOrderSwatches={onOrderSwatches}
        fullModeTitle={title}
        fullModeOptions={allOptions}
        fullModeActiveValue={activeValue}
        onFullModeSelect={onChange}
        fullModeGroupByDesc
        fullModeMaterialFilterOptions={filters.materials}
        fullModeColorFilterOptions={filters.colors}
        fullModeLookFilterOptions={filters.looks}
        fullModeTierFilterOptions={tierOptions}
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
      <ProductOptionsGrid data={visibleOptions} handleAdd={onChange} activeValue={activeValue} groupByDesc />
    </>
  );
};
