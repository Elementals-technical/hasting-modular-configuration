import dataMaterial from "@/shared/constants/DataMaterial.json";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

type MaterialMetadata = {
  hex?: string;
  Color?: string;
  Material?: string;
  Look?: string;
  image?: string;
  label?: string;
  value?: string;
};

type MaterialValue = {
  value: string;
  label: string;
  metadata?: MaterialMetadata;
};

type MaterialOption = {
  option: string;
  typeComponent?: string;
  valuesArray: MaterialValue[];
};

type FilterOption = { label: string; value: string };

type FiltersSet = {
  materials: FilterOption[];
  colors: FilterOption[];
  looks: FilterOption[];
  hex: FilterOption[];
};

export type MaterialFilterSelection = {
  material?: string;
  color?: string;
  look?: string;
  hex?: string;
};

const isMaterialOption = (item: MaterialOption, optionName: string) =>
  item.option === optionName && item.typeComponent === "material";

const parseList = (raw?: string) => raw?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];

const toFilterOptions = (set: Set<string>): FilterOption[] =>
  Array.from(set)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));

const getMaterialOption = (optionName: string) => {
  const materials = (dataMaterial as { materials?: MaterialOption[] }).materials ?? [];
  return materials.find((entry) => isMaterialOption(entry, optionName));
};

export const buildMaterialFilters = (optionName: string): FiltersSet => {
  const option = getMaterialOption(optionName);

  if (!option) return { materials: [], colors: [], looks: [], hex: [] };

  const materialSet = new Set<string>();
  const colorSet = new Set<string>();
  const lookSet = new Set<string>();
  const hexSet = new Set<string>();

  option.valuesArray.forEach(({ metadata }) => {
    if (!metadata) return;

    parseList(metadata.Material).forEach((value) => materialSet.add(value));
    parseList(metadata.Color).forEach((value) => colorSet.add(value));
    parseList(metadata.Look).forEach((value) => lookSet.add(value));

    if (metadata.hex) hexSet.add(metadata.hex.trim());
  });

  return {
    materials: toFilterOptions(materialSet),
    colors: toFilterOptions(colorSet),
    looks: toFilterOptions(lookSet),
    hex: toFilterOptions(hexSet),
  };
};

export const getMaterialOptionsGridData = (optionName: string): ProductOptionData[] => {
  const option = getMaterialOption(optionName);

  if (!option) return [];

  const sorted = [...option.valuesArray].sort((a, b) => {
    const aLabel = a.metadata?.label ?? a.label ?? a.value;
    const bLabel = b.metadata?.label ?? b.label ?? b.value;
    return aLabel.localeCompare(bLabel);
  });

  return sorted
    .filter(({ metadata }) => {
      const hasImage = Boolean(metadata?.image);
      const hasHex = Boolean(metadata?.hex?.trim());

      return hasImage || hasHex;
    })
    .map(({ value, label, metadata }) => ({
      id: value,
      title: metadata?.label ?? label ?? value,
      name: metadata?.value ?? value,
      desc: metadata?.Color ?? metadata?.Material,
      isShortDesc: false,
      metadata: {
        colors: parseList(metadata?.Color),
        materials: parseList(metadata?.Material),
        looks: parseList(metadata?.Look),
        hex: metadata?.hex?.trim(),
        value: metadata?.value ?? value,
        image: metadata?.image,
      },
    }));
};

export const filterOptionsByMaterialSelection = (
  options: ProductOptionData[],
  selectedFilter: MaterialFilterSelection,
): ProductOptionData[] => {
  return options.filter((option) => {
    const { materials, colors, looks, hex } = option.metadata ?? {};

    const materialMatch = selectedFilter.material ? materials?.includes(selectedFilter.material) : true;
    const colorMatch = selectedFilter.color ? colors?.includes(selectedFilter.color) : true;
    const lookMatch = selectedFilter.look ? looks?.includes(selectedFilter.look) : true;
    const hexMatch = selectedFilter.hex ? hex === selectedFilter.hex : true;

    return materialMatch && colorMatch && lookMatch && hexMatch;
  });
};
