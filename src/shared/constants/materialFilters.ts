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

type FilterOption = { label: string; value: string; children?: FilterOption[] };

type FiltersSet = {
  materials: FilterOption[];
  colors: FilterOption[];
  looks: FilterOption[];
  hex: FilterOption[];
};

type MaterialGroup = {
  label: string;
  value: string;
  childValues: string[];
};

const MATERIAL_HIERARCHY: MaterialGroup[] = [
  {
    label: "Solid-Surface",
    value: "solid-surface",
    childValues: ["Tekorlux", "Mineralmarmo", "Tekormud", "Tekorund", "Ocritech"],
  },
  {
    label: "Glass",
    value: "glass",
    childValues: ["Glass MT", "Glass GL", "Glass"],
  },
];

export const groupMaterialsHierarchically = (flatOptions: FilterOption[]): FilterOption[] => {
  const childToParent = new Map<string, MaterialGroup>();
  for (const group of MATERIAL_HIERARCHY) {
    for (const childValue of group.childValues) {
      childToParent.set(childValue.toLowerCase(), group);
    }
  }

  const topLevel: FilterOption[] = [];
  const grouped = new Map<string, FilterOption[]>();

  for (const option of flatOptions) {
    const parentGroup = childToParent.get(option.value.toLowerCase());

    if (parentGroup) {
      const existing = grouped.get(parentGroup.value) ?? [];
      existing.push(option);
      grouped.set(parentGroup.value, existing);
    } else {
      topLevel.push(option);
    }
  }

  const result: FilterOption[] = [];

  const insertionOrder = MATERIAL_HIERARCHY.map((g) => g.value);
  let hierarchyInserted = false;

  for (const item of topLevel) {
    if (!hierarchyInserted && item.label.localeCompare(MATERIAL_HIERARCHY[0]?.label ?? "") > 0) {
      for (const groupValue of insertionOrder) {
        const group = MATERIAL_HIERARCHY.find((g) => g.value === groupValue);
        const children = grouped.get(groupValue);
        if (group && children && children.length > 0) {
          result.push({
            label: group.label,
            value: group.value,
            children: children.sort((a, b) => a.label.localeCompare(b.label)),
          });
        }
      }
      hierarchyInserted = true;
    }
    result.push(item);
  }

  if (!hierarchyInserted) {
    for (const groupValue of insertionOrder) {
      const group = MATERIAL_HIERARCHY.find((g) => g.value === groupValue);
      const children = grouped.get(groupValue);
      if (group && children && children.length > 0) {
        result.push({
          label: group.label,
          value: group.value,
          children: children.sort((a, b) => a.label.localeCompare(b.label)),
        });
      }
    }
  }

  return result;
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
  const normalizeToken = (value?: string) => (value ?? "").trim().toLowerCase();

  return options.filter((option) => {
    const { materials, colors, looks, hex } = option.metadata ?? {};

    const normalizedMaterials = (materials ?? []).map(normalizeToken);
    const normalizedColors = (colors ?? []).map(normalizeToken);
    const normalizedLooks = (looks ?? []).map(normalizeToken);
    const normalizedHex = normalizeToken(hex);

    const materialMatch = selectedFilter.material
      ? normalizedMaterials.includes(normalizeToken(selectedFilter.material))
      : true;
    const colorMatch = selectedFilter.color ? normalizedColors.includes(normalizeToken(selectedFilter.color)) : true;
    const lookMatch = selectedFilter.look ? normalizedLooks.includes(normalizeToken(selectedFilter.look)) : true;
    const hexMatch = selectedFilter.hex ? normalizedHex === normalizeToken(selectedFilter.hex) : true;

    return materialMatch && colorMatch && lookMatch && hexMatch;
  });
};
