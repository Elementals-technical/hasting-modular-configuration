import { useMemo, useState } from "react";

import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";
import {
  ProductOptionsGrid,
  type ProductOptionData,
  type ProductOptionMetadata,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { BaseButton } from "@/shared/ui/Buttons/BaseButton";
import {
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import { PopupCenterContent } from "../PopupCenterContent/PopupCenterContent";

import s from "./FullModeColorsModal.module.scss";

type FlatFilterOption = { label: string; value: string; children?: FlatFilterOption[] };

interface FullModeColorsModalProps {
  isOpening: boolean;
  onClose: () => void;
  title: string;
  options: ProductOptionData[];
  activeValue?: string | number | null;
  onSelect?: (name: string, config?: addProductConfigI, metadata?: ProductOptionMetadata) => void | Promise<void>;
  isLoading?: boolean;
  groupByDesc?: boolean;
  showFilters?: boolean;
  materialFilterOptions?: FlatFilterOption[];
  colorFilterOptions?: FlatFilterOption[];
  lookFilterOptions?: FlatFilterOption[];
  tierFilterOptions?: FlatFilterOption[];
}

const buildFlatFilters = (options: ProductOptionData[]) => {
  const materialSet = new Set<string>();
  const colorSet = new Set<string>();
  const lookSet = new Set<string>();

  for (const option of options) {
    const metadata = option.metadata ?? {};
    (metadata.materials ?? []).forEach((value) => value && materialSet.add(value));
    (metadata.colors ?? []).forEach((value) => value && colorSet.add(value));
    (metadata.looks ?? []).forEach((value) => value && lookSet.add(value));
  }

  const toFilterOptions = (set: Set<string>): FlatFilterOption[] =>
    Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: value, value }));

  return {
    materials: toFilterOptions(materialSet),
    colors: toFilterOptions(colorSet),
    looks: toFilterOptions(lookSet),
  };
};

export const FullModeColorsModal: React.FC<FullModeColorsModalProps> = ({
  isOpening,
  onClose,
  title,
  options,
  activeValue,
  onSelect,
  isLoading,
  groupByDesc = true,
  showFilters = true,
  materialFilterOptions,
  colorFilterOptions,
  lookFilterOptions,
  tierFilterOptions,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});

  const flatFilters = useMemo(() => buildFlatFilters(options), [options]);

  const resolvedMaterialFilterOptions = useMemo(
    () => materialFilterOptions ?? groupMaterialsHierarchically(flatFilters.materials),
    [materialFilterOptions, flatFilters.materials],
  );
  const resolvedColorFilterOptions = colorFilterOptions ?? flatFilters.colors;
  const resolvedLookFilterOptions = lookFilterOptions ?? flatFilters.looks;

  const fallbackTierOptions = useMemo(() => buildTierFilterOptions(options), [options]);
  const resolvedTierFilterOptions = tierFilterOptions ?? fallbackTierOptions;

  const filteredOptions = useMemo(
    () => filterOptionsByTier(filterOptionsByMaterialSelection(options, selectedFilter), selectedFilter.tier),
    [options, selectedFilter],
  );

  const clearAllFilters = () => setSelectedFilter({});

  const hasAnyFilter = Object.values(selectedFilter).some(Boolean);

  return (
    <PopupCenterContent isOpening={isOpening} onClose={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.header}>
          <div className={s.title}>{title}</div>
          <button className={s.closeBtn} onClick={onClose} type="button">
            <CloseBtnIcon />
          </button>
        </div>

        {showFilters ? (
          <div className={s.filters}>
            <FilterRow>
              <FilterItem
                label="Material"
                options={resolvedMaterialFilterOptions}
                value={selectedFilter.material}
                onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, material: value as string }))}
              />
              <FilterItem
                label="Color"
                options={resolvedColorFilterOptions}
                value={selectedFilter.color}
                onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, color: value as string }))}
              />
              <FilterItem
                label="Look"
                options={resolvedLookFilterOptions}
                value={selectedFilter.look}
                onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, look: value as string }))}
              />
              <FilterItem
                label="Price"
                options={resolvedTierFilterOptions}
                value={selectedFilter.tier}
                onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, tier: value as string | undefined }))}
              />
              {hasAnyFilter && (
                <BaseButton variant="filterBtn" onClick={clearAllFilters}>
                  Clear All
                </BaseButton>
              )}
            </FilterRow>
          </div>
        ) : null}

        <div className={s.content}>
          <ProductOptionsGrid
            data={filteredOptions}
            handleAdd={onSelect}
            activeValue={activeValue}
            isLoading={isLoading}
            groupByDesc={groupByDesc}
          />
        </div>
      </div>
    </PopupCenterContent>
  );
};
