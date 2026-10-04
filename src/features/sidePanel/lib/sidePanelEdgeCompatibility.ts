import type { ProductProfile } from "@/entities/collection";
import { selectMessage, selectRuleData } from "@/entities/collection";
import type { SidePanelAvailabilityResult, SidePanelReasonCode } from "@/features/configurator-rule-core/options/types";
import { mapCabinetTypeToGroup } from "../model/selectors";
import {
  REASON_SIDE_PANEL_OPEN_SHELF,
  REASON_SIDE_PANEL_SIDE_SHELF,
  mapSidePanelDrawersToHandleType,
  sidePanelAvailabilityRule,
} from "./sidePanelRules";

export { mapSidePanelDrawersToHandleType };

const REASON_SIDE_PANEL_SHELVES_AT_BOTH_ENDS = "sidePanel.shelvesAtBothEnds";

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

export const isShelfSidePanelReason = (reason: string | null | undefined, profile: ProductProfile | null) =>
  reason === selectMessage(profile, REASON_SIDE_PANEL_OPEN_SHELF) ||
  reason === selectMessage(profile, REASON_SIDE_PANEL_SIDE_SHELF);

/** Structured (non-fragile) counterpart of {@link isShelfSidePanelReason}. */
export const isShelfSidePanelReasonCode = (code?: SidePanelReasonCode | null) =>
  code === "open-shelf" || code === "side-shelf";

export const resolveSelectedSidePanelSide = (selectedId?: string | null): SidePanelEntitySide => {
  const normalized = (selectedId ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (normalized.includes("sidepanelleft")) return "left";
  if (normalized.includes("sidepanelright")) return "right";
  return null;
};

export const buildSidePanelEdgeState = (
  edges: SidePanelEdgeIds,
  selectedCabinetId: string | null | undefined,
  profile: ProductProfile | null,
): SidePanelEdgeState => {
  const blockedGroups = selectRuleData(profile, "sidePanels")?.blockedCabinetTypes ?? [];
  const leftGroup = mapCabinetTypeToGroup(edges.leftCabinetId, profile);
  const rightGroup = mapCabinetTypeToGroup(edges.rightCabinetId, profile);
  const leftBlocked = leftGroup !== null && blockedGroups.includes(leftGroup);
  const rightBlocked = rightGroup !== null && blockedGroups.includes(rightGroup);
  const selected = selectedCabinetId ?? null;
  const selectedGroup = mapCabinetTypeToGroup(selected, profile);
  const isSelectedEdge = !!selected && (selected === edges.leftCabinetId || selected === edges.rightCabinetId);

  let bothEdgesBlockedReason: string | null = null;
  let bothEdgesBlockedReasonCode: SidePanelReasonCode | null = null;
  if (edges.leftCabinetId && edges.rightCabinetId && leftBlocked && rightBlocked) {
    if (leftGroup === "OS" && rightGroup === "OS") {
      bothEdgesBlockedReason = selectMessage(profile, REASON_SIDE_PANEL_OPEN_SHELF);
      bothEdgesBlockedReasonCode = "both-open-shelf";
    } else if (leftGroup === "OSS" && rightGroup === "OSS") {
      bothEdgesBlockedReason = selectMessage(profile, REASON_SIDE_PANEL_SIDE_SHELF);
      bothEdgesBlockedReasonCode = "both-side-shelf";
    } else {
      bothEdgesBlockedReason = selectMessage(profile, REASON_SIDE_PANEL_SHELVES_AT_BOTH_ENDS);
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
  profile,
}: {
  selectedAvailability: SidePanelAvailabilityResult;
  edgeState: SidePanelEdgeState;
  height?: number | null;
  edgeDrawers?: string | null;
  profile: ProductProfile | null;
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

  return sidePanelAvailabilityRule(
    {
      height,
      handleType: mapSidePanelDrawersToHandleType(edgeDrawers, profile),
      cabinetType: "SBSC",
    },
    profile,
  );
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
