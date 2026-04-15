import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { MultiSelect, type IMultiSelectOption } from "../MultiSelect/MultiSelect";
import {
  getAllMaterialValues,
  getMaterialSelectStateFilters,
} from "../../model/store/selectors";
import { setMaterialSelect } from "../../model/store/slice";
import { splitMetadataList } from "../../lib/SwatchesServices";

export const LooksFilter = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(getMaterialSelectStateFilters);
  const allMaterialsValues = useAppSelector(getAllMaterialValues);

  const options = useMemo<IMultiSelectOption[]>(() => {
    const unique = new Set<string>();
    for (const item of allMaterialsValues) {
      for (const token of splitMetadataList(item.metadata?.Look)) unique.add(token);
    }
    return Array.from(unique)
      .sort((a, b) => a.localeCompare(b))
      .map((look) => {
        const count = allMaterialsValues.filter((item) =>
          splitMetadataList(item.metadata?.Look).includes(look),
        ).length;
        return { value: look, label: look, count };
      });
  }, [allMaterialsValues]);

  return (
    <MultiSelect
      options={options}
      values={filters.Look}
      onValueChange={(values) => dispatch(setMaterialSelect({ filterName: "Look", values }))}
      placeholder="Look"
    />
  );
};
