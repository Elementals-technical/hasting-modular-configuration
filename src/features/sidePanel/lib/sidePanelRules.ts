import type { ProductProfile } from "@/entities/collection";
import { selectAttribute, selectMessage, selectRuleData } from "@/entities/collection";
import type {
  SidePanelAvailabilityInput,
  SidePanelAvailabilityResult,
  SidePanelCountertopLengthInput,
  SidePanelCountertopLengthResult,
  SidePanelReasonCode,
  SidePanelSpecInput,
  SidePanelSpecResult,
  SyntesiSidePanelRuleInput,
  SyntesiSidePanelRuleResult,
} from "@/features/configurator-rule-core/options/types";

/**
 * Side panel rules. The availability table, the blocked cabinet groups, the length increment
 * and the panel quantity come from `ruleData.sidePanels` of the active collection; a
 * collection without that section does not offer side panels.
 */

export const REASON_SIDE_PANEL_NOT_IN_COLLECTION = "sidePanel.notInCollection";
export const REASON_SIDE_PANEL_SIDE_SHELF = "sidePanel.sideShelfUnavailable";
export const REASON_SIDE_PANEL_OPEN_SHELF = "sidePanel.openShelfUnavailable";
const REASON_SYNTESI_SIDE_PANELS = "syntesi.sidePanelsUnavailable";

type SidePanelGroove = SidePanelAvailabilityResult["allowed"] extends Set<infer Groove> ? Groove : never;
type SidePanelCabinetType = NonNullable<SidePanelAvailabilityInput["cabinetType"]>;
type SidePanelHandleType = NonNullable<SidePanelAvailabilityInput["handleType"]>;

const GROOVES: readonly SidePanelGroove[] = ["NoG", "UpperG", "CenterG", "DoubleG"];
const isGroove = (value: string): value is SidePanelGroove => (GROOVES as readonly string[]).includes(value);

/** Structured reason of a blocked cabinet group; the group ids themselves are the code's own. */
const BLOCKER_BY_CABINET_TYPE: Partial<
  Record<SidePanelCabinetType, { reasonCode: SidePanelReasonCode; messageCode: string }>
> = {
  OSS: { reasonCode: "side-shelf", messageCode: REASON_SIDE_PANEL_SIDE_SHELF },
  OS: { reasonCode: "open-shelf", messageCode: REASON_SIDE_PANEL_OPEN_SHELF },
};

const isSidePanelsEnabled = (value: string | null | undefined, profile: ProductProfile | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return trimmed !== selectAttribute(profile, "SidePanels")?.noneValue;
};

/** Drawer group of the availability table ("1D", "2D") that a cabinet's drawers belong to. */
export const mapSidePanelDrawersToHandleType = (
  drawers: string | null | undefined,
  profile: ProductProfile | null,
): SidePanelHandleType | null => {
  if (!drawers) return null;

  const groups = selectRuleData(profile, "sidePanels")?.drawersByHandleType;
  const group = groups ? Object.entries(groups).find(([, values]) => values.includes(drawers))?.[0] : undefined;

  return group === "1D" || group === "2D" ? group : null;
};

export const sidePanelSpecRule = (
  { sidePanels, cabinetHeight, cabinetDepth, heightType }: SidePanelSpecInput,
  profile: ProductProfile | null,
): SidePanelSpecResult => {
  const params = selectRuleData(profile, "sidePanels");
  if (!params || !isSidePanelsEnabled(sidePanels, profile)) {
    return { enabled: false };
  }

  const qty = heightType === "LOW" ? undefined : params.defaultQuantityUnlessHeightTypeLow;

  return {
    enabled: true,
    qty,
    height: typeof cabinetHeight === "number" ? cabinetHeight : null,
    depth: typeof cabinetDepth === "number" ? cabinetDepth : null,
  };
};

export const sidePanelCountertopLengthRule = (
  { sidePanels, vanityLength }: SidePanelCountertopLengthInput,
  profile: ProductProfile | null,
): SidePanelCountertopLengthResult => {
  if (typeof vanityLength !== "number") return { length: null };

  const params = selectRuleData(profile, "sidePanels");
  if (!params || !isSidePanelsEnabled(sidePanels, profile)) {
    return { length: vanityLength };
  }

  return { length: vanityLength + params.countertopLengthIncrementCm };
};

export const syntesiSidePanelRule = (
  { sidePanels, countertopMaterial }: SyntesiSidePanelRuleInput,
  profile: ProductProfile | null,
): SyntesiSidePanelRuleResult => {
  if (!isSidePanelsEnabled(sidePanels, profile)) return { allowed: true };

  // A collection without Syntesi, or whose Syntesi allows panels, has nothing to forbid.
  const syntesi = selectRuleData(profile, "syntesi");
  if (!syntesi || syntesi.allowsSidePanels) return { allowed: true };

  if (countertopMaterial?.trim() === syntesi.material) {
    return { allowed: false, reason: selectMessage(profile, REASON_SYNTESI_SIDE_PANELS) };
  }

  return { allowed: true };
};

export const sidePanelAvailabilityRule = (
  { height, handleType, cabinetType }: SidePanelAvailabilityInput,
  profile: ProductProfile | null,
): SidePanelAvailabilityResult => {
  const allowed = new Set<SidePanelGroove>();

  const params = selectRuleData(profile, "sidePanels");
  if (!params) {
    return {
      allowed,
      reason: selectMessage(profile, REASON_SIDE_PANEL_NOT_IN_COLLECTION),
      reasonCode: "not-in-collection",
    };
  }

  const blocker =
    cabinetType && params.blockedCabinetTypes.includes(cabinetType) ? BLOCKER_BY_CABINET_TYPE[cabinetType] : undefined;
  if (blocker) {
    return { allowed, reason: selectMessage(profile, blocker.messageCode), reasonCode: blocker.reasonCode };
  }

  const heightToken = typeof height === "number" ? params.heightTokenByCm[String(height)] : undefined;
  if (!heightToken || !cabinetType) {
    return { allowed };
  }

  const match = params.availability.find(
    (row) =>
      row.height === heightToken && row.cabinetType === cabinetType && (!handleType || row.handleType === handleType),
  );

  if (!match) {
    return { allowed };
  }

  match.allowed.filter(isGroove).forEach((groove) => allowed.add(groove));

  return { allowed };
};
