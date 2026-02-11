import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";

interface FilterItemI {
  label: string;
  options: { label: string; value: string }[];
  value?: string | number;
  onSelect?: (value: string | number) => void;
}

export const FilterItem: React.FC<FilterItemI> = ({ label, options, value, onSelect }) => {
  const handleSelect = (val: string | number) => {
    onSelect?.(val);
  };

  return <FilterSelection label={label} options={options} value={value} onSelect={handleSelect} />;
};
