import type { GrooveType, SidePanelStatus } from "./sidePanelService";
import { sidePanelAvailabilityRule } from "./sidePanelRules";
import {
  mapSidePanelDrawersToHandleType,
  type SidePanelEdgeState,
  type SidePanelTargetSide,
} from "./sidePanelEdgeCompatibility";

export type SidePanelApplySide = "left" | "right" | "both";
type SidePanelPhysicalSide = Exclude<SidePanelApplySide, "both">;

export type SidePanelSyncPrompt = {
  requestedGroove: GrooveType;
  targetSide: SidePanelPhysicalSide;
  otherSide: SidePanelPhysicalSide;
};

const GROOVE_LABELS: Record<GrooveType, string> = {
  None: "None",
  NoG: "No groove",
  UpperG: "1 groove (upper)",
  CenterG: "1 groove (central)",
  DoubleG: "2 grooves",
};

const SIDE_PANEL_SIDE_LABELS: Record<SidePanelPhysicalSide, string> = {
  left: "left",
  right: "right",
};

const OPPOSITE_SIDE_BY_SIDE = {
  left: "right",
  right: "left",
} as const satisfies Record<SidePanelPhysicalSide, SidePanelPhysicalSide>;

const EDGE_GROUP_BY_SIDE = {
  left: (edgeState: SidePanelEdgeState) => edgeState.leftGroup,
  right: (edgeState: SidePanelEdgeState) => edgeState.rightGroup,
} as const satisfies Record<SidePanelPhysicalSide, (edgeState: SidePanelEdgeState) => SidePanelEdgeState["leftGroup"]>;

type SidePanelStatusLookupInput = {
  leftStatus: SidePanelStatus;
  rightStatus: SidePanelStatus;
};

const STATUS_BY_SIDE = {
  left: ({ leftStatus }: SidePanelStatusLookupInput) => leftStatus,
  right: ({ rightStatus }: SidePanelStatusLookupInput) => rightStatus,
} as const satisfies Record<SidePanelPhysicalSide, (input: SidePanelStatusLookupInput) => SidePanelStatus>;

type SidePanelCanAcceptLookupInput = {
  leftCanAcceptGroove: boolean;
  rightCanAcceptGroove: boolean;
};

const CAN_ACCEPT_GROOVE_BY_SIDE = {
  left: ({ leftCanAcceptGroove }: SidePanelCanAcceptLookupInput) => leftCanAcceptGroove,
  right: ({ rightCanAcceptGroove }: SidePanelCanAcceptLookupInput) => rightCanAcceptGroove,
} as const satisfies Record<SidePanelPhysicalSide, (input: SidePanelCanAcceptLookupInput) => boolean>;

const isGrooveType = (value?: string | null): value is GrooveType => !!value && value in GROOVE_LABELS;

const normalizeGroove = (value?: string | null): GrooveType => (isGrooveType(value) ? value : "None");

export const formatSidePanelGrooveLabel = (value: string): string => GROOVE_LABELS[normalizeGroove(value)];

export const formatSidePanelSideLabel = (side: SidePanelPhysicalSide) => SIDE_PANEL_SIDE_LABELS[side];

export const resolveSidePanelGridActiveValue = ({
  targetSide,
  groove,
  leftStatus,
  rightStatus,
}: {
  targetSide: SidePanelTargetSide;
  groove?: string | null;
  leftStatus: SidePanelStatus;
  rightStatus: SidePanelStatus;
}): GrooveType => {
  const activeGroove = normalizeGroove(groove);
  if (activeGroove === "None") return "None";

  if (targetSide === "left") return leftStatus === "active" ? activeGroove : "None";
  if (targetSide === "right") return rightStatus === "active" ? activeGroove : "None";
  if (targetSide === "both") return leftStatus === "active" || rightStatus === "active" ? activeGroove : "None";

  return "None";
};

export const isSidePanelGrooveAvailableForSide = ({
  edgeState,
  side,
  groove,
  height,
  edgeDrawers,
}: {
  edgeState: SidePanelEdgeState;
  side: SidePanelPhysicalSide;
  groove: GrooveType;
  height?: number | null;
  edgeDrawers?: string | null;
}): boolean => {
  if (groove === "None") return true;

  const group = EDGE_GROUP_BY_SIDE[side](edgeState);
  if (group !== "SBSC") return false;

  return sidePanelAvailabilityRule({
    height,
    handleType: mapSidePanelDrawersToHandleType(edgeDrawers),
    cabinetType: "SBSC",
  }).allowed.has(groove);
};

export const resolveSidePanelSyncPrompt = ({
  targetSide,
  requestedGroove,
  currentGroove,
  leftStatus,
  rightStatus,
  leftCanAcceptGroove,
  rightCanAcceptGroove,
}: {
  targetSide: SidePanelTargetSide;
  requestedGroove: GrooveType;
  currentGroove?: string | null;
  leftStatus: SidePanelStatus;
  rightStatus: SidePanelStatus;
  leftCanAcceptGroove: boolean;
  rightCanAcceptGroove: boolean;
}): SidePanelSyncPrompt | null => {
  if (requestedGroove === "None") return null;
  if (targetSide !== "left" && targetSide !== "right") return null;
  if (normalizeGroove(currentGroove) === requestedGroove) return null;

  const otherSide = OPPOSITE_SIDE_BY_SIDE[targetSide];
  const statusInput = { leftStatus, rightStatus };
  const canAcceptInput = { leftCanAcceptGroove, rightCanAcceptGroove };
  const otherSideActive = STATUS_BY_SIDE[otherSide](statusInput) === "active";
  const otherSideCanAcceptGroove = CAN_ACCEPT_GROOVE_BY_SIDE[otherSide](canAcceptInput);

  if (!otherSideActive || !otherSideCanAcceptGroove) return null;

  return {
    requestedGroove,
    targetSide,
    otherSide,
  };
};
