import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";

interface FilterItemI {
  label: string;
  options: { label: string; value: string }[];
}

export const FilterItem: React.FC<FilterItemI> = ({ label, options }) => {
  const handleSelect = () => {
    console.log("handle select");
  };

  return <FilterSelection label={label} options={options} onSelect={handleSelect} />;
};
