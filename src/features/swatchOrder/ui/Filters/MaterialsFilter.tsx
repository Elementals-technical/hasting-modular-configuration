import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { MultiSelect, type IMultiSelectOption } from "../MultiSelect/MultiSelect";
import {
  getAllMaterialValues,
  getMaterialSelectStateFilters,
} from "../../model/store/selectors";
import { setMaterialSelect } from "../../model/store/slice";

export const MaterialsFilter = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(getMaterialSelectStateFilters);
  const allMaterialsValues = useAppSelector(getAllMaterialValues);

  const options = useMemo<IMultiSelectOption[]>(() => {
    const unique = new Set<string>();
    for (const item of allMaterialsValues) {
      const value = item.metadata?.Finish ?? item.metadata?.Material;
      if (value) unique.add(value);
    }
    return Array.from(unique)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => {
        const count = allMaterialsValues.filter(
          (item) => item.metadata?.Finish === value || item.metadata?.Material === value,
        ).length;
        return { value, label: value, count };
      });
  }, [allMaterialsValues]);

  return (
    <MultiSelect
      options={options}
      values={filters.Finish}
      onValueChange={(values) => dispatch(setMaterialSelect({ filterName: "Finish", values }))}
      placeholder="Material"
    />
  );
};
