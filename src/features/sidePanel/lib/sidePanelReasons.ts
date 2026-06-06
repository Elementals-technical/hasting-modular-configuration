import type { SidePanelAvailabilityResult } from "@/features/configurator-rule-core/options/types";
import { cmToInches } from "@/shared/lib/sku/cmToInches";
import {
  resolveSelectedSidePanelSide,
  type SidePanelEdgeState,
  type SidePanelTargetSide,
} from "./sidePanelEdgeCompatibility";

/**
 * Single source of truth for the Side Panel "why can't I use this" messaging.
 *
 * Replaces the chained ternary + scattered guards that were duplicated across
 * the custom and prebuilt accessories pages. Two layers:
 *
 *  - BLOCK reasons   → hide the options grid, show one message (priority-ordered).
 *  - NOTICE          → non-blocking target/fallback guidance shown above a working grid.
 *
 * Adding a new block reason = append one descriptor here; both pages + the
 * apply guard pick it up automatically.
 */

/** Exact cabinet-only vanity length (cm) at which side panels are hard-blocked. */
export const SIDE_PANEL_LENGTH_BLOCK_CM = 340;
/** Tolerance for the 340cm comparison (floating-point safety). */
const LENGTH_BLOCK_EPSILON = 0.01;

export const SIDE_PANEL_SELECT_END_HINT = "Select an end cabinet to add side panels.";

export type SidePanelReasonCtx = {
  /** Number of cabinets in the current composition. */
  cabinetCount: number;
  /** Is there a currently selected cabinet at all. */
  hasSelectedCabinet: boolean;
  /** Is the selected cabinet a left/right edge cabinet. */
  isEdgeCabinet: boolean;
  /** Cabinet-only total vanity length in cm (null if unknown). */
  cabinetOnlyLength: number | null;
  /** Availability already aggregates Syntesi / OS-both / OSS-both / mixed-both. */
  availability: SidePanelAvailabilityResult;
};

export type SidePanelBlockId = "length-340" | "availability";

export type SidePanelBlockReason = {
  id: SidePanelBlockId;
  /** Lower number wins. */
  priority: number;
  predicate: (ctx: SidePanelReasonCtx) => boolean;
  message: (ctx: SidePanelReasonCtx) => string;
};

export type SidePanelNotice = {
  tone: "info" | "warning";
  targetLabel: "Left end" | "Right end" | "Both ends";
  message: string;
};

type ResolvedSidePanelTargetSide = Exclude<SidePanelTargetSide, null>;

type SidePanelNoticeInput = {
  cabinetCount: number;
  selectedCabinetId?: string | null;
  edgeState: SidePanelEdgeState;
  targetSide: SidePanelTargetSide;
};

type SidePanelNoticeCtx = {
  cabinetCount: number;
  edgeState: SidePanelEdgeState;
  targetSide: ResolvedSidePanelTargetSide;
  targetLabel: SidePanelNotice["targetLabel"];
  hasSelected: boolean;
  selectedSidePanelSide: ReturnType<typeof resolveSelectedSidePanelSide>;
  selectedEdgeIsTarget: boolean;
  selectedEdgeIsBlocked: boolean;
};

type SidePanelNoticeRule = {
  id: string;
  predicate: (ctx: SidePanelNoticeCtx) => boolean;
  resolve: (ctx: SidePanelNoticeCtx) => SidePanelNotice | null;
};

const TARGET_LABEL_BY_SIDE = {
  left: "Left end",
  right: "Right end",
  both: "Both ends",
} as const satisfies Record<ResolvedSidePanelTargetSide, SidePanelNotice["targetLabel"]>;

const BLOCKED_CABINET_LABEL_BY_GROUP: Partial<Record<NonNullable<SidePanelEdgeState["selectedGroup"]>, string>> = {
  OS: "Open Shelf",
  OSS: "Side-Shelf",
};

const NO_SELECTION_NOTICE_MESSAGE_BY_TARGET = {
  left: (ctx: SidePanelNoticeCtx) => `Side panel changes will apply to the ${ctx.targetLabel.toLowerCase()} cabinet.`,
  right: (ctx: SidePanelNoticeCtx) => `Side panel changes will apply to the ${ctx.targetLabel.toLowerCase()} cabinet.`,
  both: () => "Side panel changes will apply to both vanity ends.",
} as const satisfies Record<ResolvedSidePanelTargetSide, (ctx: SidePanelNoticeCtx) => string>;

const formatBlockedCabinetLabel = (group: SidePanelEdgeState["selectedGroup"]) =>
  group ? (BLOCKED_CABINET_LABEL_BY_GROUP[group] ?? "This cabinet") : "This cabinet";

const createInfoNotice = (ctx: SidePanelNoticeCtx, message: string): SidePanelNotice => ({
  tone: "info",
  targetLabel: ctx.targetLabel,
  message,
});

const SIDE_PANEL_NOTICE_RULES: readonly SidePanelNoticeRule[] = [
  {
    id: "single-cabinet",
    predicate: (ctx) => ctx.cabinetCount <= 1 || ctx.edgeState.leftCabinetId === ctx.edgeState.rightCabinetId,
    resolve: () => null,
  },
  {
    id: "no-selected-cabinet",
    predicate: (ctx) => !ctx.hasSelected,
    resolve: (ctx) => createInfoNotice(ctx, NO_SELECTION_NOTICE_MESSAGE_BY_TARGET[ctx.targetSide](ctx)),
  },
  {
    id: "selected-side-panel-entity",
    predicate: (ctx) => !!ctx.selectedSidePanelSide,
    resolve: (ctx) =>
      createInfoNotice(
        ctx,
        `Side panel changes will apply to the selected ${ctx.targetLabel.toLowerCase()} side panel.`,
      ),
  },
  {
    id: "selected-blocked-edge",
    predicate: (ctx) => ctx.selectedEdgeIsBlocked,
    resolve: (ctx) => ({
      tone: "warning",
      targetLabel: ctx.targetLabel,
      message: `${formatBlockedCabinetLabel(
        ctx.edgeState.selectedGroup,
      )} cannot receive side panels. This selection will apply to the ${ctx.targetLabel.toLowerCase()} cabinet.`,
    }),
  },
  {
    id: "both-eligible-ends",
    predicate: (ctx) => ctx.targetSide === "both",
    resolve: (ctx) =>
      createInfoNotice(
        ctx,
        "Side panels will be installed on both end cabinets. Select a specific end cabinet to apply one side only.",
      ),
  },
  {
    id: "selected-interior-cabinet",
    predicate: (ctx) => !ctx.edgeState.isSelectedEdge,
    resolve: (ctx) =>
      createInfoNotice(
        ctx,
        `The selected cabinet is inside the vanity. Side panel changes will apply to the ${ctx.targetLabel.toLowerCase()} cabinet.`,
      ),
  },
  {
    id: "selected-target-edge",
    predicate: (ctx) => ctx.selectedEdgeIsTarget,
    resolve: (ctx) =>
      createInfoNotice(ctx, `Side panel changes will apply to the selected ${ctx.targetLabel.toLowerCase()} cabinet.`),
  },
  {
    id: "target-edge-fallback",
    predicate: () => true,
    resolve: (ctx) =>
      createInfoNotice(ctx, `Side panel changes will apply to the ${ctx.targetLabel.toLowerCase()} cabinet.`),
  },
];

export const formatSidePanelLength340Reason = (): string =>
  `Side panels are not available when total vanity length is exactly ${SIDE_PANEL_LENGTH_BLOCK_CM} cm (${cmToInches(
    SIDE_PANEL_LENGTH_BLOCK_CM,
  )}").`;

export const isSidePanelLengthBlocked = (cabinetOnlyLength: number | null): boolean =>
  cabinetOnlyLength !== null && Math.abs(cabinetOnlyLength - SIDE_PANEL_LENGTH_BLOCK_CM) < LENGTH_BLOCK_EPSILON;

/**
 * BLOCK reasons — when any matches, the options grid is hidden and the
 * highest-priority message is shown. Order in the array is irrelevant;
 * `priority` decides. Keep `length-340` above `availability` so the exact-340
 * message wins over a generic availability reason (preserves prior behavior).
 */
export const SIDE_PANEL_BLOCK_REASONS: readonly SidePanelBlockReason[] = [
  {
    id: "length-340",
    priority: 10,
    predicate: (ctx) => isSidePanelLengthBlocked(ctx.cabinetOnlyLength),
    message: () => formatSidePanelLength340Reason(),
  },
  {
    id: "availability",
    // Syntesi material / Open-Shelf at both ends / Side-Shelf at both ends /
    // mixed OS+OSS at both ends — all surface as availability.reason.
    priority: 20,
    predicate: (ctx) => !!ctx.availability.reason,
    message: (ctx) => ctx.availability.reason ?? "",
  },
];

/** Returns the highest-priority block reason, or null if the grid should show. */
export const resolveSidePanelBlock = (ctx: SidePanelReasonCtx): SidePanelBlockReason | null =>
  [...SIDE_PANEL_BLOCK_REASONS].sort((a, b) => a.priority - b.priority).find((r) => r.predicate(ctx)) ?? null;

/**
 * Legacy HINT — kept for compatibility with older imports.
 *  - Single-cabinet config: nothing (a lone cabinet is always its own edge).
 *  - Multi-cabinet, an edge cabinet already selected: nothing.
 *  - Multi-cabinet otherwise: nudge the user to pick an end cabinet.
 *
 * Current UI uses resolveSidePanelNotice for more explicit target feedback.
 */
export const resolveSidePanelHint = (ctx: SidePanelReasonCtx): string | null => {
  if (ctx.cabinetCount <= 1) return null;
  if (ctx.hasSelectedCabinet && ctx.isEdgeCabinet) return null;
  return SIDE_PANEL_SELECT_END_HINT;
};

export const resolveSidePanelNotice = ({
  cabinetCount,
  selectedCabinetId,
  edgeState,
  targetSide,
}: SidePanelNoticeInput): SidePanelNotice | null => {
  if (!targetSide) return null;

  const selected = selectedCabinetId ?? null;
  const hasSelected = !!selected;
  const selectedSidePanelSide = resolveSelectedSidePanelSide(selected);
  const selectedIsLeft = hasSelected && selected === edgeState.leftCabinetId;
  const selectedIsRight = hasSelected && selected === edgeState.rightCabinetId;
  const selectedEdgeIsTarget = (targetSide === "left" && selectedIsLeft) || (targetSide === "right" && selectedIsRight);
  const selectedEdgeIsBlocked =
    (selectedIsLeft && edgeState.leftGroup !== "SBSC") || (selectedIsRight && edgeState.rightGroup !== "SBSC");

  const ctx: SidePanelNoticeCtx = {
    cabinetCount,
    edgeState,
    targetSide,
    targetLabel: TARGET_LABEL_BY_SIDE[targetSide],
    hasSelected,
    selectedSidePanelSide,
    selectedEdgeIsTarget,
    selectedEdgeIsBlocked,
  };

  return SIDE_PANEL_NOTICE_RULES.find((rule) => rule.predicate(ctx))?.resolve(ctx) ?? null;
};
