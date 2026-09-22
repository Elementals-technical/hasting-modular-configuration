import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { BaseButton } from "@/shared";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";

import type { MaterialFilterOption } from "../lib/countertopColorOptions";
import type { FilterOption, MaterialFilterSelection } from "@/shared/constants/materialFilters";

import s from "./CountertopSections.module.scss";

type MaterialFilterRowProps = {
  filters: { materials: MaterialFilterOption[]; colors: FilterOption[]; looks: FilterOption[] };
  tiers: FilterOption[];
  selection: MaterialFilterSelection;
  onChange: (selection: MaterialFilterSelection) => void;
};

/** Material, colour, look and price filters of a colour grid; a material may be disabled with a reason. */
export const MaterialFilterRow = ({ filters, tiers, selection, onChange }: MaterialFilterRowProps) => {
  const select = (key: keyof MaterialFilterSelection) => (value?: string | number) =>
    onChange({ ...selection, [key]: value === undefined ? undefined : String(value) });

  return (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={filters.materials}
        value={selection.material}
        onSelect={select("material")}
      />
      <FilterItem label="Color" options={filters.colors} value={selection.color} onSelect={select("color")} />
      <FilterItem label="Look" options={filters.looks} value={selection.look} onSelect={select("look")} />
      <FilterItem label="Price" options={tiers} value={selection.tier} onSelect={select("tier")} />
      {Object.values(selection).some(Boolean) && (
        <BaseButton variant="filterBtn" onClick={() => onChange({})}>
          Clear All
        </BaseButton>
      )}
    </FilterRow>
  );
};
