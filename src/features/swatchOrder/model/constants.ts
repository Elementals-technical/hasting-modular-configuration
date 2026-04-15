export const MAX_SLOTS = 5;

export const FILTER_TO_VALUE_KEY = {
  Finish: "Material",
  Color: "Color",
  Look: "Look",
} as const;

export const STORAGE_KEY = "swatchOrder:selectedMaterials";
export const STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000;
