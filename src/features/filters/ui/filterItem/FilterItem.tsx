import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";

type FilterOption = {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
  reason?: string;
  children?: FilterOption[];
};

interface FilterItemI {
  label: string;
  options: FilterOption[];
  value?: string | number;
  onSelect?: (value?: string | number) => void;
  allowShowAll?: boolean;
  hintPlacement?: "top" | "bottom" | "left" | "right";
}

const isAllOption = (option: FilterOption) => {
  const optionLabel = (option.label ?? "").toLowerCase();
  const optionValue = (option.value ?? "").toLowerCase();
  return optionLabel === "all" || optionLabel === "show all" || optionValue === "all";
};

const hasAllOption = (options: FilterOption[]) => options.some(isAllOption);

export const FilterItem: React.FC<FilterItemI> = ({ label, options, value, onSelect, allowShowAll, hintPlacement }) => {
  // A filter with nothing to choose (no option but All) is left out; one holding a value stays, so it can be cleared.
  if (options.every(isAllOption) && (value === undefined || value === "")) return null;

  const handleSelect = (val?: string | number) => {
    onSelect?.(val);
  };

  const showAllEnabled = allowShowAll ?? !hasAllOption(options);

  return (
    <FilterSelection
      label={label}
      options={options}
      value={value}
      onSelect={handleSelect}
      allowShowAll={showAllEnabled}
      hintPlacement={hintPlacement}
    />
  );
};
