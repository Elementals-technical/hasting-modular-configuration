import { SIDE_PANEL_AVAILABILITY, SIDE_PANELS_NONE, SYNTESI_MATERIAL_TOKEN } from "../constants";
import type {
  SidePanelAvailabilityInput,
  SidePanelAvailabilityResult,
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

const mapHeightToken = (height?: number | null) => {
  if (typeof height !== "number") return null;
  if (height === 50) return "50H";
  if (height === 53) return "53H";
  if (height === 56) return "56H";
  return null;
};

export const sidePanelAvailabilityRule = ({
  height,
  handleType,
  cabinetType,
}: SidePanelAvailabilityInput): SidePanelAvailabilityResult => {
  const allowed = new Set<"NoG" | "UpperG" | "CenterG" | "DoubleG">();

  if (cabinetType === "OSS") {
    return { allowed, reason: "Side panels are not available for Side-Shelf cabinets." };
  }

  if (cabinetType === "OS") {
    return { allowed, reason: "Side panels are not available when an Open-Shelf cabinet is used as an end cabinet." };
  }

  const heightToken = mapHeightToken(height);
  if (!heightToken || !cabinetType) {
    return { allowed };
  }

  // OS cabinets don't have drawers, so handleType may be null — match by height+cabinetType only
  const match = handleType
    ? SIDE_PANEL_AVAILABILITY.find(
        (row) => row.height === heightToken && row.handleType === handleType && row.cabinetType === cabinetType,
      )
    : SIDE_PANEL_AVAILABILITY.find((row) => row.height === heightToken && row.cabinetType === cabinetType);

  if (!match) {
    return { allowed };
  }

  if (match.allowed.noGroove) allowed.add("NoG");
  if (match.allowed.upperGroove) allowed.add("UpperG");
  if (match.allowed.centerGroove) allowed.add("CenterG");
  if (match.allowed.doubleGroove) allowed.add("DoubleG");

  return { allowed };
};
