import { SIDE_PANEL_AVAILABILITY, SIDE_PANELS_NONE, SYNTESI_MATERIAL_TOKEN } from "./constants";
import type {
  SidePanelAvailabilityInput,
  SidePanelAvailabilityResult,
  SidePanelCountertopLengthInput,
  SidePanelCountertopLengthResult,
  SidePanelSpecInput,
  SidePanelSpecResult,
  SyntesiSidePanelRuleInput,
  SyntesiSidePanelRuleResult,
} from "@/features/configurator-rule-core/options/types";
import { SYNTESI_SIDE_PANEL_UNAVAILABLE_REASON } from "@/features/configurator-rule-core/countertop";

export const SIDE_PANEL_SIDE_SHELF_UNAVAILABLE_REASON = "Side panels are not available for Side-Shelf cabinets.";
export const SIDE_PANEL_OPEN_SHELF_UNAVAILABLE_REASON =
  "Side panels are not available for use with Open Shelf cabinets.";

type SidePanelAvailabilityRow = (typeof SIDE_PANEL_AVAILABILITY)[number];
type SidePanelHeightToken = SidePanelAvailabilityRow["height"];
type SidePanelAllowedFlag = keyof SidePanelAvailabilityRow["allowed"];
type SidePanelGroove = SidePanelAvailabilityResult["allowed"] extends Set<infer Groove> ? Groove : never;
type SidePanelCabinetType = NonNullable<SidePanelAvailabilityInput["cabinetType"]>;

const HEIGHT_TOKEN_BY_CM: Partial<Record<number, SidePanelHeightToken>> = {
  50: "50H",
  53: "53H",
  56: "56H",
};

const CABINET_TYPE_AVAILABILITY_BLOCKERS: Partial<
  Record<SidePanelCabinetType, Pick<SidePanelAvailabilityResult, "reason" | "reasonCode">>
> = {
  OSS: {
    reason: SIDE_PANEL_SIDE_SHELF_UNAVAILABLE_REASON,
    reasonCode: "side-shelf",
  },
  OS: {
    reason: SIDE_PANEL_OPEN_SHELF_UNAVAILABLE_REASON,
    reasonCode: "open-shelf",
  },
};

const GROOVE_BY_ALLOWED_FLAG: readonly [SidePanelAllowedFlag, SidePanelGroove][] = [
  ["noGroove", "NoG"],
  ["upperGroove", "UpperG"],
  ["centerGroove", "CenterG"],
  ["doubleGroove", "DoubleG"],
];

const isSidePanelsEnabled = (value?: string | null) => {
  if (!value) return false;
  return value.trim() !== "" && value.trim() !== SIDE_PANELS_NONE;
};

export const sidePanelSpecRule = ({
  sidePanels,
  cabinetHeight,
  cabinetDepth,
  heightType,
}: SidePanelSpecInput): SidePanelSpecResult => {
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
    return { allowed: false, reason: SYNTESI_SIDE_PANEL_UNAVAILABLE_REASON };
  }

  return { allowed: true };
};

const mapHeightToken = (height?: number | null) => {
  if (typeof height !== "number") return null;
  return HEIGHT_TOKEN_BY_CM[height] ?? null;
};

const matchesSidePanelAvailabilityRow = ({
  row,
  heightToken,
  handleType,
  cabinetType,
}: {
  row: SidePanelAvailabilityRow;
  heightToken: SidePanelHeightToken;
  handleType: SidePanelAvailabilityInput["handleType"];
  cabinetType: SidePanelAvailabilityInput["cabinetType"];
}) => row.height === heightToken && row.cabinetType === cabinetType && (!handleType || row.handleType === handleType);

export const sidePanelAvailabilityRule = ({
  height,
  handleType,
  cabinetType,
}: SidePanelAvailabilityInput): SidePanelAvailabilityResult => {
  const allowed = new Set<"NoG" | "UpperG" | "CenterG" | "DoubleG">();

  const blocker = cabinetType ? CABINET_TYPE_AVAILABILITY_BLOCKERS[cabinetType] : undefined;
  if (blocker) {
    return { allowed, ...blocker };
  }

  const heightToken = mapHeightToken(height);
  if (!heightToken || !cabinetType) {
    return { allowed };
  }

  const match = SIDE_PANEL_AVAILABILITY.find((row) =>
    matchesSidePanelAvailabilityRow({ row, heightToken, handleType, cabinetType }),
  );

  if (!match) {
    return { allowed };
  }

  GROOVE_BY_ALLOWED_FLAG.filter(([flag]) => match.allowed[flag]).forEach(([, groove]) => allowed.add(groove));

  return { allowed };
};
