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

export type FilterOption = { label: string; value: string; children?: FilterOption[] };

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
  aliases?: string[];
};

const MATERIAL_HIERARCHY: MaterialGroup[] = [
  {
    label: "Solid Surface",
    value: "solid-surface",
    childValues: ["Mineralmarmo", "Ocritech", "Syntesi", "Tekorlux", "Tekormud"],
    aliases: ["Solid-Surface", "Solid Surface", "SolidSurface"],
  },
  {
    label: "Glass",
    value: "glass",
    childValues: ["Glass", "Glass GL", "Glass MT"],
    aliases: ["Glass"],
  },
];

const normalizeGroupToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const groupMaterialsHierarchically = (flatOptions: FilterOption[]): FilterOption[] => {
  const childToParent = new Map<string, MaterialGroup>();
  const parentAliasToGroup = new Map<string, MaterialGroup>();

  for (const group of MATERIAL_HIERARCHY) {
    for (const childValue of group.childValues) {
      childToParent.set(normalizeGroupToken(childValue), group);
    }

    const aliasValues = [group.label, group.value, ...(group.aliases ?? [])];
    aliasValues.forEach((alias) => parentAliasToGroup.set(normalizeGroupToken(alias), group));
  }

  const topLevel: FilterOption[] = [];
  const grouped = new Map<string, FilterOption[]>();
  const standaloneParentOption = new Map<string, FilterOption>();

  const mergeChildren = (children: FilterOption[], standalone?: FilterOption): FilterOption[] => {
    const next = [...children];
    if (!standalone) return next;

    const normalizedStandalone = normalizeGroupToken(standalone.value || standalone.label);
    const alreadyExists = next.some(
      (child) => normalizeGroupToken(child.value || child.label) === normalizedStandalone,
    );

    if (!alreadyExists) {
      next.unshift(standalone);
    }

    return next;
  };

  const sortGroupChildren = (children: FilterOption[]): FilterOption[] =>
    [...children].sort((a, b) => a.label.localeCompare(b.label));

  for (const option of flatOptions) {
    const normalizedValue = normalizeGroupToken(option.value);
    const normalizedLabel = normalizeGroupToken(option.label);
    const parentGroup = childToParent.get(normalizedValue) ?? childToParent.get(normalizedLabel);

    if (parentGroup) {
      const existing = grouped.get(parentGroup.value) ?? [];
      existing.push(option);
      grouped.set(parentGroup.value, existing);
      continue;
    }

    const parentAliasGroup = parentAliasToGroup.get(normalizedValue) ?? parentAliasToGroup.get(normalizedLabel);

    if (parentAliasGroup) {
      if (!standaloneParentOption.has(parentAliasGroup.value)) {
        standaloneParentOption.set(parentAliasGroup.value, option);
      }
      continue;
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
          const mergedChildren = mergeChildren(children, standaloneParentOption.get(groupValue));
          result.push({
            label: group.label,
            value: group.label,
            children: sortGroupChildren(mergedChildren),
          });
        } else if (group) {
          const standalone = standaloneParentOption.get(groupValue);
          if (standalone) result.push(standalone);
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
        const mergedChildren = mergeChildren(children, standaloneParentOption.get(groupValue));
        result.push({
          label: group.label,
          value: group.label,
          children: sortGroupChildren(mergedChildren),
        });
      } else if (group) {
        const standalone = standaloneParentOption.get(groupValue);
        if (standalone) result.push(standalone);
      }
    }
  }

  return result;
};

const findFilterOptionInTree = (options: readonly FilterOption[], target: string): FilterOption | null => {
  for (const option of options) {
    if (option.value === target) return option;

    if (option.children?.length) {
      const found = findFilterOptionInTree(option.children, target);
      if (found) return found;
    }
  }

  return null;
};

export const resolveSelectedMaterialFilterValues = (
  options: readonly FilterOption[],
  selected?: string,
): string[] => {
  if (!selected) return [];

  const selectedNode = findFilterOptionInTree(options, selected);
  if (selectedNode?.children?.length) {
    return selectedNode.children.map((child) => child.value);
  }

  return [selected];
};

export const materialFilterValuesMatch = (optionMaterial: string, selectedMaterial: string): boolean => {
  return normalizeGroupToken(optionMaterial) === normalizeGroupToken(selectedMaterial);
};

const flattenFilterOptionsInOrder = (options: FilterOption[]): string[] =>
  options.flatMap((option) => {
    const ownValues = [option.label, option.value].filter(Boolean);
    if (!option.children?.length) return ownValues;

    return [...ownValues, ...flattenFilterOptionsInOrder(option.children)];
  });

const buildMaterialOrderIndex = (options: FilterOption[]) => {
  const index = new Map<string, number>();

  flattenFilterOptionsInOrder(options).forEach((token, position) => {
    const normalized = normalizeGroupToken(token);
    if (!normalized || index.has(normalized)) return;
    index.set(normalized, position);
  });

  return index;
};

const resolveOptionMaterialPosition = (option: ProductOptionData, orderIndex: Map<string, number>) => {
  const candidates = [option.desc, ...(option.metadata?.materials ?? [])];

  let bestPosition = Number.MAX_SAFE_INTEGER;
  for (const candidate of candidates) {
    const position = orderIndex.get(normalizeGroupToken(candidate ?? ""));
    if (position !== undefined) {
      bestPosition = Math.min(bestPosition, position);
    }
  }

  return bestPosition;
};

export const sortOptionsByMaterialFilterOrder = (
  options: ProductOptionData[],
  materialFilterOptions: FilterOption[],
): ProductOptionData[] => {
  const orderIndex = buildMaterialOrderIndex(materialFilterOptions);

  return [...options].sort((a, b) => {
    const materialPositionDiff =
      resolveOptionMaterialPosition(a, orderIndex) - resolveOptionMaterialPosition(b, orderIndex);
    if (materialPositionDiff !== 0) return materialPositionDiff;

    const descDiff = (a.desc ?? "").localeCompare(b.desc ?? "");
    if (descDiff !== 0) return descDiff;

    return a.title.localeCompare(b.title);
  });
};

export type MaterialFilterSelection = {
  material?: string;
  color?: string;
  look?: string;
  hex?: string;
  tier?: string;
};

const isMaterialOption = (item: MaterialOption, optionName: string) =>
  item.option === optionName && item.typeComponent === "material";

const parseList = (raw?: string) =>
  raw
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

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
