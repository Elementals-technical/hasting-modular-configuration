import type { SceneCompositionPlacement } from "@/entities/configuration";
import type { ScenePlus, ScenePlusKind } from "@/utils/functions/playcanvas/sceneBridge";

/**
 * What a scene "+" places, and which "+" a cabinet may use.
 *
 * A row that holds columns (Urban Duplex) has two "+" at each end: `left` / `right`, which add
 * beside the end cabinet as in any row, and the hanging-level `left-top` / `right-top`, placed at
 * the place the scene offers there. `top` / `bottom` put the cabinet in the free place of a
 * column. Either way the scene stands it on the floor or hangs it by its height.
 */

const SIDE_SHELF = "Side-Shelf";
const OPEN_SHELF = "Open-Shelf";
const SINK_BASE = "Sink-Base";

/** The row end a "+" stands at; null for the free place of a column. */
export const rowEndSideOf = (kind: ScenePlusKind): "left" | "right" | null => {
  switch (kind) {
    case "left":
    case "left-top":
      return "left";
    case "right":
    case "right-top":
      return "right";
    case "top":
    case "bottom":
      return null;
  }
};

/** Where the "+" of `kind` by `anchorRuntimeId` places a cabinet. */
export const placementForPlus = (kind: ScenePlusKind, anchorRuntimeId: string): SceneCompositionPlacement => {
  switch (kind) {
    case "left":
    case "right":
      return { kind: "beside", anchorRuntimeId, side: kind };
    case "left-top":
      return { kind: "slot", anchorRuntimeId, slot: "left" };
    case "right-top":
      return { kind: "slot", anchorRuntimeId, slot: "right" };
    case "top":
    case "bottom":
      return { kind: "slot", anchorRuntimeId, slot: kind };
  }
};

export type PlusFilterOptions = {
  /**
   * Whether the collection places cabinets at the places the scene offers (its Drag & Drop is on).
   * Without it only `left` / `right` are shown: a column could not be saved or undone.
   */
  columns: boolean;
  /**
   * Whether the row the "+" adds to has room for the cabinet, and may take its type (the length rule row
   * by row). Asked after the placement rules; without it every "+" those rules keep is shown.
   */
  fits?: (plus: ScenePlus) => boolean;
};

const fitsPlacement = (
  cabinetType: string | null,
  cabinetTypeOf: (runtimeId: string) => string | null,
  columns: boolean,
  plus: ScenePlus,
): boolean => {
  if (!columns || cabinetType === SIDE_SHELF) return plus.kind === "left" || plus.kind === "right";
  if (cabinetType === OPEN_SHELF && rowEndSideOf(plus.kind) === null) return false;
  if (cabinetType === SINK_BASE && plus.kind === "bottom") return false;
  return !(plus.kind === "top" && cabinetTypeOf(plus.cabinetId) === SINK_BASE);
};

/**
 * The "+" that fit the cabinet about to be added, by its type as the collection names it:
 * - a shelf never goes in a column, and a Side-Shelf only at a row end, standing;
 * - nothing goes on a sink base, so not over a lone one, and a sink base never goes under a cabinet;
 * - with `fits`, only a row with room for it.
 * The scene checks the rest when it places the cabinet.
 */
export const plusFilterFor =
  (
    cabinetType: string | null,
    cabinetTypeOf: (runtimeId: string) => string | null,
    { columns, fits }: PlusFilterOptions,
  ) =>
  (plus: ScenePlus): boolean =>
    fitsPlacement(cabinetType, cabinetTypeOf, columns, plus) && (fits?.(plus) ?? true);
