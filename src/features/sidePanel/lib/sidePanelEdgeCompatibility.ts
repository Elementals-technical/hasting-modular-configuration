import type { SidePanelAvailabilityResult, SidePanelReasonCode } from "@/features/configurator-rule-core/options/types";
import { mapCabinetTypeToGroup } from "../model/selectors";
import {
  SIDE_PANEL_OPEN_SHELF_UNAVAILABLE_REASON,
  SIDE_PANEL_SIDE_SHELF_UNAVAILABLE_REASON,
  sidePanelAvailabilityRule,
} from "./sidePanelRules";

export type SidePanelEdgeIds = {
  leftCabinetId: string | null;
  rightCabinetId: string | null;
};

export type SidePanelEdgeState = SidePanelEdgeIds & {
  leftGroup: ReturnType<typeof mapCabinetTypeToGroup>;
  rightGroup: ReturnType<typeof mapCabinetTypeToGroup>;
  selectedGroup: ReturnType<typeof mapCabinetTypeToGroup>;
  isSelectedEdge: boolean;
  eligibleFallbackEdgeId: string | null;
  bothEdgesBlockedReason: string | null;
  bothEdgesBlockedReasonCode: SidePanelReasonCode | null;
};

export type SidePanelTargetSide = "left" | "right" | "both" | null;
export type SidePanelEntitySide = "left" | "right" | null;

const EMPTY_AVAILABILITY: SidePanelAvailabilityResult = {
  allowed: new Set<"NoG" | "UpperG" | "CenterG" | "DoubleG">(),
};

export const isShelfSidePanelReason = (reason?: string | null) =>
  reason === SIDE_PANEL_OPEN_SHELF_UNAVAILABLE_REASON || reason === SIDE_PANEL_SIDE_SHELF_UNAVAILABLE_REASON;

/** Structured (non-fragile) counterpart of {@link isShelfSidePanelReason}. */
export const isShelfSidePanelReasonCode = (code?: SidePanelReasonCode | null) =>
  code === "open-shelf" || code === "side-shelf";

export const mapSidePanelDrawersToHandleType = (drawers?: string | null) => {
  if (!drawers) return null;

  if (drawers === "1D" || drawers === "1DWID" || drawers === "1" || drawers === "1+inner") return "1D";
  if (drawers === "2D" || drawers === "2") return "2D";
  return null;
};

export const resolveSelectedSidePanelSide = (selectedId?: string | null): SidePanelEntitySide => {
  const normalized = (selectedId ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (normalized.includes("sidepanelleft")) return "left";
  if (normalized.includes("sidepanelright")) return "right";
  return null;
};

export const buildSidePanelEdgeState = (
  edges: SidePanelEdgeIds,
  selectedCabinetId?: string | null,
): SidePanelEdgeState => {
  const leftGroup = mapCabinetTypeToGroup(edges.leftCabinetId);
  const rightGroup = mapCabinetTypeToGroup(edges.rightCabinetId);
  const leftBlocked = leftGroup === "OS" || leftGroup === "OSS";
  const rightBlocked = rightGroup === "OS" || rightGroup === "OSS";
  const selected = selectedCabinetId ?? null;
  const selectedGroup = mapCabinetTypeToGroup(selected);
  const isSelectedEdge = !!selected && (selected === edges.leftCabinetId || selected === edges.rightCabinetId);

  let bothEdgesBlockedReason: string | null = null;
  let bothEdgesBlockedReasonCode: SidePanelReasonCode | null = null;
  if (edges.leftCabinetId && edges.rightCabinetId && leftBlocked && rightBlocked) {
    if (leftGroup === "OS" && rightGroup === "OS") {
      bothEdgesBlockedReason = SIDE_PANEL_OPEN_SHELF_UNAVAILABLE_REASON;
      bothEdgesBlockedReasonCode = "both-open-shelf";
    } else if (leftGroup === "OSS" && rightGroup === "OSS") {
      bothEdgesBlockedReason = SIDE_PANEL_SIDE_SHELF_UNAVAILABLE_REASON;
      bothEdgesBlockedReasonCode = "both-side-shelf";
    } else {
      bothEdgesBlockedReason =
        "Side panels are not available when Open Shelf or Side-Shelf cabinets are positioned at both ends.";
      bothEdgesBlockedReasonCode = "mixed-open-side-shelf";
    }
  }

  const eligibleFallbackEdgeId =
    leftGroup === "SBSC" ? edges.leftCabinetId : rightGroup === "SBSC" ? edges.rightCabinetId : null;

  return {
    ...edges,
    leftGroup,
    rightGroup,
    selectedGroup,
    isSelectedEdge,
    eligibleFallbackEdgeId,
    bothEdgesBlockedReason,
    bothEdgesBlockedReasonCode,
  };
};

export const resolveSidePanelAvailabilityForEdges = ({
  selectedAvailability,
  edgeState,
  height,
  edgeDrawers,
}: {
  selectedAvailability: SidePanelAvailabilityResult;
  edgeState: SidePanelEdgeState;
  height?: number | null;
  edgeDrawers?: string | null;
}): SidePanelAvailabilityResult => {
  if (edgeState.bothEdgesBlockedReason) {
    return {
      ...EMPTY_AVAILABILITY,
      reason: edgeState.bothEdgesBlockedReason,
      reasonCode: edgeState.bothEdgesBlockedReasonCode ?? undefined,
    };
  }

  if (selectedAvailability.allowed.size > 0 || !isShelfSidePanelReasonCode(selectedAvailability.reasonCode)) {
    return selectedAvailability;
  }

  if (!edgeState.eligibleFallbackEdgeId) {
    return selectedAvailability;
  }

  return sidePanelAvailabilityRule({
    height,
    handleType: mapSidePanelDrawersToHandleType(edgeDrawers),
    cabinetType: "SBSC",
  });
};

export const resolveSidePanelTargetSide = ({
  edgeState,
  selectedCabinetId,
  cabinetCount,
}: {
  edgeState: SidePanelEdgeState;
  selectedCabinetId?: string | null;
  cabinetCount: number;
}): SidePanelTargetSide => {
  const { leftCabinetId, rightCabinetId, leftGroup, rightGroup, bothEdgesBlockedReason } = edgeState;

  if (bothEdgesBlockedReason) return null;
  if (cabinetCount <= 0) return null;

  const isSingleCabinet = cabinetCount === 1 || (!!leftCabinetId && leftCabinetId === rightCabinetId);
  if (isSingleCabinet) {
    return leftGroup === "SBSC" || rightGroup === "SBSC" ? "both" : null;
  }

  const leftEligible = leftGroup === "SBSC";
  const rightEligible = rightGroup === "SBSC";
  const selected = selectedCabinetId ?? null;
  const selectedSidePanelSide = resolveSelectedSidePanelSide(selected);

  if (selectedSidePanelSide === "left") return leftEligible ? "left" : null;
  if (selectedSidePanelSide === "right") return rightEligible ? "right" : null;

  if (selected === leftCabinetId && leftEligible) return "left";
  if (selected === rightCabinetId && rightEligible) return "right";

  if (leftEligible && rightEligible) return "both";
  if (leftEligible) return "left";
  if (rightEligible) return "right";

  return null;
};
