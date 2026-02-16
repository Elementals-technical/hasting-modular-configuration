import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";

type FilterOption = {
  label: string;
  value: string;
  children?: FilterOption[];
};

interface FilterItemI {
  label: string;
  options: FilterOption[];
  value?: string | number;
  onSelect?: (value: string | number) => void;
}

export const FilterItem: React.FC<FilterItemI> = ({ label, options, value, onSelect }) => {
  const handleSelect = (val: string | number) => {
    onSelect?.(val);
  };

  return <FilterSelection label={label} options={options} value={value} onSelect={handleSelect} />;
};
