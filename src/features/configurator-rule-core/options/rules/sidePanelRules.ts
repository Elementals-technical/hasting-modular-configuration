import { SIDE_PANELS_NONE, SYNTESI_MATERIAL_TOKEN } from "../constants";
import type {
  SidePanelCountertopLengthInput,
  SidePanelCountertopLengthResult,
  SidePanelSpecInput,
  SidePanelSpecResult,
  SyntesiSidePanelRuleInput,
  SyntesiSidePanelRuleResult,
} from "../types";

const isSidePanelsEnabled = (value?: string | null) => {
  if (!value) return false;
  return value.trim() !== "" && value.trim() !== SIDE_PANELS_NONE;
};

export const sidePanelSpecRule = ({ sidePanels, cabinetHeight, cabinetDepth, heightType }: SidePanelSpecInput): SidePanelSpecResult => {
  if (!isSidePanelsEnabled(sidePanels)) {
    return { enabled: false };
  }

  const qty = heightType === "LOW" ? undefined : 2;

  return {
    enabled: true,
    qty,
    height: typeof cabinetHeight === "number" ? cabinetHeight : null,
    depth: typeof cabinetDepth === "number" ? cabinetDepth : null,
  };
};

export const sidePanelCountertopLengthRule = ({
  sidePanels,
  vanityLength,
}: SidePanelCountertopLengthInput): SidePanelCountertopLengthResult => {
  if (typeof vanityLength !== "number") return { length: null };

  if (!isSidePanelsEnabled(sidePanels)) {
    return { length: vanityLength };
  }

  return { length: vanityLength + 2 };
};

export const syntesiSidePanelRule = ({
  sidePanels,
  countertopMaterial,
}: SyntesiSidePanelRuleInput): SyntesiSidePanelRuleResult => {
  if (!isSidePanelsEnabled(sidePanels)) return { allowed: true };

  if (countertopMaterial?.trim() === SYNTESI_MATERIAL_TOKEN) {
    return { allowed: false, reason: "Syntesi is not available with side panels." };
  }

  return { allowed: true };
};
