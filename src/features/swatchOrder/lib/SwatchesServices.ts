import type {
  IMaterialSelectState,
  IProductElementOption,
  TFilterName,
} from "../model/types";
import { FILTER_TO_VALUE_KEY } from "../model/constants";

const isEqual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const splitMetadataList = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

interface FilterItem {
  filterKey: string;
  filterCount: number;
}

interface FilterGroup {
  filterType: TFilterName;
  filters: FilterItem[];
}

const mapFiltersFromValues = (
  allValues: IProductElementOption[],
  selected: IMaterialSelectState,
): FilterGroup[] => {
  return (Object.keys(selected) as TFilterName[]).map((filterType) => {
    const valueKey = FILTER_TO_VALUE_KEY[filterType];
    const requested = selected[filterType];

    const filters: FilterItem[] = requested.map((filterKey) => {
      let occurrences = 0;
      for (const group of allValues) {
        for (const entry of group.valuesArray) {
          const list = splitMetadataList(entry.metadata?.[valueKey]);
          occurrences += list.filter((v) => isEqual(v, filterKey)).length;
        }
      }
      return { filterKey, filterCount: occurrences };
    });

    return { filterType, filters };
  });
};

const getPositiveSelectedFilers = (mapped: FilterGroup[]) =>
  mapped
    .map((group) => ({
      filterName: group.filterType,
      filterKeys: group.filters.filter((f) => f.filterCount !== 0).map((f) => f.filterKey),
    }))
    .filter((group) => group.filterKeys.length > 0);

export const SwatchesServices = {
  mapFiltersFromValues,
  getPositiveSelectedFilers,
};
