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

const hasAllOption = (options: FilterOption[]) =>
  options.some((option) => {
    const optionLabel = (option.label ?? "").toLowerCase();
    const optionValue = (option.value ?? "").toLowerCase();
    return optionLabel === "all" || optionLabel === "show all" || optionValue === "all";
  });

export const FilterItem: React.FC<FilterItemI> = ({ label, options, value, onSelect, allowShowAll, hintPlacement }) => {
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
