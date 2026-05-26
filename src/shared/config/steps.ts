const STEP_HEADER_PREFIX = "Select";

export type ConfiguratorStep = {
  id: string;
  label: string;
  path: string;
  headerPrefix?: string | null;
};

export const getStepHeaderLabel = (step: ConfiguratorStep): string =>
  step.headerPrefix === null ? step.label : `${step.headerPrefix ?? STEP_HEADER_PREFIX} ${step.label}`;

export const PREBUILT_STEPS: ConfiguratorStep[] = [
  { id: "model", label: "Model", path: "/prebuilt/model" },
  { id: "cabinet", label: "Color", path: "/prebuilt/color" },
  { id: "countertop", label: "Countertop & Basin", path: "/prebuilt/countertop" },
  { id: "accessories", label: "Accessories", path: "/prebuilt/accessories" },
  { id: "faucet-holes", label: "Faucet Details", path: "/prebuilt/faucet-holes" },
  { id: "summary", label: "Summary", path: "/prebuilt/summary" },
];

export const CUSTOM_STEPS: ConfiguratorStep[] = [
  { id: "cabinet-builder", label: "Cabinet Builder", headerPrefix: null, path: "/custom/cabinet-builder" },
  { id: "cabinet-colors", label: "Color", path: "/custom/cabinet-colors" },
  { id: "countertop", label: "Countertop & Basin", path: "/custom/countertop" },
  { id: "accessories", label: "Accessories", path: "/custom/accessories" },
  { id: "faucet-holes", label: "Faucet Details", path: "/custom/faucet-holes" },
  { id: "summary", label: "Summary", path: "/custom/summary" },
];
