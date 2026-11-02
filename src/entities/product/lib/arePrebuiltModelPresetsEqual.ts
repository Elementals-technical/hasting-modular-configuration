import type { PresetProduct } from "../types";
import { PREBUILT_MODEL_TRANSFERABLE_FIELDS } from "./prebuiltModelTransferableFields";

const PREBUILT_MODEL_TRANSFERABLE_FIELD_SET = new Set<keyof PresetProduct>(PREBUILT_MODEL_TRANSFERABLE_FIELDS);

const getComparablePresetKeys = (preset: PresetProduct): Array<keyof PresetProduct> =>
  Object.keys(preset).filter(
    (key): key is keyof PresetProduct => !PREBUILT_MODEL_TRANSFERABLE_FIELD_SET.has(key as keyof PresetProduct),
  );

/**
 * A value the preset leaves out and one recorded empty mean the same: selecting a model records ""
 * for what it doesn't have (the legs of a model without them). `0` is a value like any other.
 */
const toComparableValue = (value: PresetProduct[keyof PresetProduct]) => (value === "" ? null : (value ?? null));

export const arePrebuiltModelPresetsEqual = (left: PresetProduct[] = [], right: PresetProduct[] = []) => {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const compare = right[index];
    if (!compare) return false;

    const keys = new Set<keyof PresetProduct>([...getComparablePresetKeys(item), ...getComparablePresetKeys(compare)]);

    for (const key of keys) {
      if (toComparableValue(item[key]) !== toComparableValue(compare[key])) {
        return false;
      }
    }

    return true;
  });
};
