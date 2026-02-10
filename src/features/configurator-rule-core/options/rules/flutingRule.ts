import { FLUTING_VALUES } from "../constants";
import type { FlutingRuleInput, FlutingRuleResult, OptionState } from "../types";

const toOptionStates = (values: { value: string; label: string }[]): OptionState<string>[] =>
  values.map((entry) => ({
    value: entry.value,
    label: entry.label,
    enabled: true,
  }));

const normalizeDrawers = (value?: string | null) => {
  if (!value) return null;
  if (value === "1D") return "1DW";
  if (value === "2D") return "2DW";
  if (value === "1DWID") return "1DWID";
  return value;
};

const isLacquerMatte = (material?: string | null) => {
  if (!material) return false;
  const normalized = material.trim().toUpperCase();
  return (
    normalized === "LACM" ||
    normalized === "LACQUER MATTE" ||
    normalized === "LACQUERED MATTE" ||
    normalized === "LACQUERED MT" ||
    normalized === "LACQUER MT"
  );
};

export const flutingRule = ({ targetPart, isOpenShelf, material, drawers }: FlutingRuleInput): FlutingRuleResult => {
  if (targetPart === "SIDE_PANEL") {
    return { available: false, options: [], reason: "Fluting is not available for side panels." };
  }

  if (isOpenShelf) {
    return { available: false, options: [], reason: "Fluting is not available for open shelves." };
  }

  if (!isLacquerMatte(material)) {
    return { available: false, options: [], reason: "Fluting is available only for Lacquer Matte (LACM)." };
  }

  const normalizedDrawers = normalizeDrawers(drawers);
  const allowedDrawers = new Set(["1DW", "1DWID", "2DW"]);

  if (!normalizedDrawers || !allowedDrawers.has(normalizedDrawers)) {
    return { available: false, options: [], reason: "Fluting is available only for 1DW, 1DWID, or 2DW cabinets." };
  }

  return {
    available: true,
    options: toOptionStates(FLUTING_VALUES),
  };
};
