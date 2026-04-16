import { cmToInches } from "@/shared/lib/sku/cmToInches";

// CM -> display-inch lookup from the sizing spec.
// Keep this shared so sidebar and scene menus render identical labels.
const CM_TO_INCH_LABEL: Record<number, string> = {
  // Width
  25: '9.8"',
  35: '13.8"',
  50: '19.7"',
  60: '23.6"',
  70: '27.6"',
  80: '31.5"',
  90: '35.4"',
  105: '41.3"',
  120: '47.2"',
  // Depth
  45.5: '17.9"' /* 50 -> 19.7" already listed above */,
  // Height
  53: '20.9"',
  56: '22"',
};

export const cmToInchLabel = (cm: number): string => {
  const rounded = Number(cm.toFixed(1));
  if (rounded in CM_TO_INCH_LABEL) return CM_TO_INCH_LABEL[rounded];
  return `${cmToInches(cm)}"`;
};
