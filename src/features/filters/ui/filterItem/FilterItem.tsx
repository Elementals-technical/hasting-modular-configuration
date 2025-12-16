import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";

interface FilterItemI {
  label: string;
  options: { label: string; value: string }[];
  onSelect?: (value: string | number) => void;
}

export const FilterItem: React.FC<FilterItemI> = ({ label, options, onSelect }) => {
  const handleSelect = (value: string | number) => {
    onSelect?.(value);
  };

  return <FilterSelection label={label} options={options} onSelect={handleSelect} />;
};
